(function (Scratch) {
    class dumb {
        constructor(Scratch) {
            this.vm = Scratch.vm; // VM
            this.runtime = Scratch.vm.runtime; // Runtime
            this.targets = Scratch.vm.runtime.targets // Access variables
            this.uuid = null;
            this.username = null;
            this.websocket = null;
            this.cons = {};
            this.mode = null;
            this.newestPeer = {};
            this.configuration = {
                iceServers: [
                    // Omega STUN/TURN servers
                    { urls: 'stun:stun.mikedev101.cc:3478' },
                    { urls: 'turn:stun.mikedev101.cc:3478', username: 'foobar', credential: 'foobar' },

                    // Google STUN server in case Omega STUN server is unavailable/overloaded
                    { urls: 'stun:stun.l.google.com:19302' },
                ]
            }

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
                DISCOVER: 35,
            }
        }

        getInfo() {
            return {
                id: 'dumb',
                name: 'A dumb extension',
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
                        text: 'Connect to game [UGI] as username [USERNAME] using server [SERVER]',
                        arguments: {
                            UGI: {
                                type: 'string',
                                defaultValue: 'UGI',
                            },
                            USERNAME: {
                                type: 'string',
                                defaultValue: 'Apple',
                            },
                            SERVER: {
                                type: 'string',
                                defaultValue: 'wss://omega.mikedev101.cc/',
                            },
                        }
                    },
                    {
                        opcode: 'is_signalling_connected',
                        blockType: 'Boolean',
                        text: 'Connected to game server?',
                    },
                    "---",
                    {
                        opcode: 'my_uuid',
                        blockType: 'reporter',
                        text: 'My UUID',
                    },
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
                            }
                        }
                    },
                    "---",
                    {
                        opcode: 'host',
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
                        opcode: 'peer',
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
                        opcode: "on_channel_message",
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
                            },
                        },
                    },
                    "---",
                    {
                        opcode: "on_channel_cloud_list",
                        blockType: "hat",
                        text: "(CURRENTLY NOT IMPLEMENTED) When I get a cloud list named [LISTNAME] from peer [PEER] in channel [CHANNEL]",
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
                                defaultValue: 'UUID',
                            },
                        },
                    },
                    {
                        opcode: "send_list",
                        blockType: "command",
                        text: "(CURRENTLY NOT IMPLEMENTED) Send cloud list [LISTNAME] to peer [PEER] using channel [CHANNEL] and wait for cloud list to finish sending? [WAIT]",
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
                                defaultValue: 'UUID',
                            },
                            WAIT: {
                                type: 'Boolean',
                                defaultValue: false,
                            },
                        },
                    },
                    {
                        opcode: "channel_data_store_in_list",
                        blockType: "command",
                        text: "Store received messages from peer [PEER]'s channel [CHANNEL] into list [LIST]",
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'default',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'UUID',
                            },
                            LIST: {
                                type: 'string',
                                defaultValue: 'my list',
                            },
                        },
                    },
                    {
                        opcode: "make_list",
                        blockType: "command",
                        text: "(CURRENTLY NOT IMPLEMENTED) Make list [LIST] a cloud list named [LISTNAME]",
                        arguments: {
                            LIST: {
                                type: 'string',
                                defaultValue: 'my list',
                            },
                            LISTNAME: {
                                type: 'string',
                                defaultValue: 'my cloud list',
                            },
                        },
                    },
                    "---",
                    {
                        opcode: 'newchan',
                        blockType: 'command',
                        text: 'Open a new data channel named [CHANNEL] with peer [PEER] and make messages [ORDERED]',
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'foobar',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'UUID',
                            },
                            ORDERED: {
                                type: 'number',
                                menu: 'channelConfig',
                                defaultValue: "1",
                            },
                        },
                    },
                    {
                        opcode: 'closechan',
                        blockType: 'command',
                        text: 'Close data channel named [CHANNEL] with peer [PEER]',
                        arguments: {
                            CHANNEL: {
                                type: 'string',
                                defaultValue: 'foobar',
                            },
                            PEER: {
                                type: 'string',
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
                            },
                        },
                    },
                    {
                        opcode: "leave",
                        blockType: "command",
                        text: "Disconnect from game",
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

        makeValueScratchSafe(data) {
            if (typeof data == "object") {
                try {
                    return JSON.stringify(data);
                } catch (SyntaxError) {
                    return String(data);
                }
            } else {
                return String(data);
            }
        }

        initializeCon(con, peerUsername, peerUUID) {
            const self = this;

            // Log connection state changes
            con.onsignalingstatechange = (e) => {
                switch (con.signalingState) {
                    case "new": break;
                    case "connecting": break;
                    case "stable": 
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) connected.`);
                        self.newestPeer = {
                            id: String(peerUUID),
                            username: String(peerUsername),
                        };
                        self.runtime.startHats("dumb_on_new_peer");
                        break;
                    
                    case "closing": break;
                    case "failed":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnected (Connection lost or failed).`);
                        // Destroy peer reference
                        if (self.cons[peerUUID]) {
                            delete self.cons[peerUUID];
                        }
                        break;
                    case "closed":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnected (Remote closure).`);
                        // Destroy peer reference
                        if (self.cons[peerUUID]) {
                            delete self.cons[peerUUID];
                        }
                        break;
                }
            };
        }

        initializeDataChannel(chan, peerUUID, peerUsername) {
            const self = this;
            chan.onopen = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" opened! Is this channel ordered: ${chan.ordered}, ID: ${chan.id}`);

                // If we are the lobby host, find all other peers and notify newest peer of other peers existing (DISCOVERY protocol)
                if (this.mode == "host" && chan.label == "default") {

                    // Gather all peers
                    for (const uuid in self.cons) {

                        // Check if peer is valid, exclude ourselves and the new peer we have added
                        if (self.cons.hasOwnProperty(uuid))  {

                            // Exclude ourselves and origin
                            if (uuid == peerUUID) continue;
                            if (uuid == self.uuid) continue;

                            // Send discovery
                            chan.send(JSON.stringify({
                                command: "discovery",
                                payload: {
                                    id: String(uuid),
                                    username: String(self.cons[uuid].username),
                                },
                            }));
                        };
                    };
                }
            }
            chan.onmessage = async(e) => {
                let message = JSON.parse(e.data);
                let peerCon, peerChan, variables, lists, offer, answer = null;

                // Handle channel commands
                switch (message.command) {

                    // If peer, accept the peer from discovery message provided by the host. Ask the host to notify the discovered peer to make an offer and relay it back to us.
                    case "discovery":
                        if (this.mode != "peer") return;
                        console.log(`Host ${peerUsername} (${peerUUID}) wants us to discover new peer ${message.payload.username} (${message.payload.id}), requesting offer`);

                        chan.send(JSON.stringify({
                            command: "discovery_accept",
                            payload: {
                                id: message.payload.id,
                                username: message.payload.username,
                            },
                        }));

                        break;

                    // If host, tell the discovered peer to make an offer
                    case "discovery_accept":
                        if (this.mode != "host") return;
                        console.log(`Peer ${peerUsername} (${peerUUID}) accepted new peer ${message.payload.username} (${message.payload.id}) discovery, requesting offer`);
                        
                        // Get discovered peer
                        peerChan = self.cons[message.payload.id].chans['default'].chan;

                        // Relay request to discovered peer
                        peerChan.send(JSON.stringify({
                            command: "discovery_init",
                            payload: {
                                id: peerUUID,
                                username: peerUsername,
                            },
                        }));

                        break;
                    
                    // If peer, create new connection and relay the request back to original peer with the host as a relay
                    case "discovery_init":
                        if (this.mode != "peer") return;
                        console.log(`Host ${peerUsername} (${peerUUID}) is negotiating new peer ${message.payload.username} (${message.payload.id}) discovery, making offer`);

                        // Create new connection object
                        peerCon = new RTCPeerConnection(self.configuration);
                        self.cons[message.payload.id] = {
                            con: peerCon,
                            chans: {},
                            nextchanid: 1,
                            uuid: message.payload.id,
                            username: message.payload.username,
                        };
                        self.initializeCon(peerCon, message.payload.username, message.payload.id);

                        // Gather ICE candidates and send them to peer
                        peerCon.addEventListener("icecandidate", (e) => {
                            if (!e.candidate) return;

                            // Send the ICE offer to the host for relaying
                            chan.send(JSON.stringify({
                                command: "discovery_ice",
                                payload: e.candidate.toJSON(),
                                rx: {
                                    id: message.payload.id,
                                    username: message.payload.username,
                                },
                            }))
                        
                        });

                        // Create new data channel
                        peerChan = peerCon.createDataChannel("default", {
                            ordered: true,
                            negotiated: true,
                            id: 0,
                        });
                        self.cons[message.payload.id].chans['default'] = {
                            chan: peerChan,
                            lists: {},
                            vars: {},
                            cloudlists: {},
                            new: false,
                            value: "",
                        };
                        self.initializeDataChannel(peerChan, message.payload.id, message.payload.username);

                        // Generate offer
                        offer = await peerCon.createOffer();

                        // Set local description
                        await peerCon.setLocalDescription(offer);

                        // Send offer to the host, host will relay offer to peer
                        chan.send(JSON.stringify({
                            command: "discovery_make_offer",
                            payload: peerCon.localDescription,
                            rx: {
                                id: message.payload.id,
                                username: message.payload.username,
                            },
                        }));

                        break;
                    
                    // If host, relay ICE candidate to peer. If peer, read the ICE candidate and add it to newly discovered peer connection.
                    case "discovery_ice":

                        if (this.mode == "host") {
                            console.log(`Peer ${peerUsername} (${peerUUID}) is offering ICE to peer ${message.rx.username} (${message.rx.id}), relaying ICE`);

                            // Get discovered peer
                            peerChan = self.cons[message.rx.id].chans['default'].chan;

                            // Relay request to discovered peer
                            peerChan.send(JSON.stringify({
                                command: "discovery_ice",
                                payload: message.payload,
                                tx: {
                                    id: peerUUID,
                                    username: peerUsername,
                                },
                            }));
                        
                        }
                        else if (this.mode == "peer") {
                            console.log(`Host ${peerUsername} (${peerUUID}) returned ICE offer from peer ${message.tx.username} (${message.tx.id}), configuring ICE`);

                            // Get discovered peer
                            peerCon = self.cons[message.tx.id].con;

                            // Set ICE candidate
                            peerCon.addIceCandidate(new RTCIceCandidate(message.payload));
                        }

                        break;
                    
                    // If host, relay the offer. If peer, create our own peer connection and send back answer.
                    case "discovery_make_offer":

                        // Relay message
                        if (this.mode == "host")  {
                            console.log(`Peer ${peerUsername} (${peerUUID}) made offer to ${message.rx.username} (${message.rx.id}), relaying offer`);

                            // Get peer
                            peerChan = self.cons[message.rx.id].chans['default'].chan;

                            // Relay offer to peer
                            peerChan.send(JSON.stringify({
                                command: "discovery_make_offer",
                                payload: message.payload,
                                tx: {
                                    id: peerUUID,
                                    username: peerUsername,
                                },
                            }));
                        }

                        // Create connection, make an answer to offer
                        else if (this.mode == "peer") {
                            console.log(`Host ${peerUsername} (${peerUUID}) returned offer from ${message.tx.username} (${message.tx.id}), creating answer`);

                            // Create new connection object
                            peerCon = new RTCPeerConnection(self.configuration);
                            self.cons[message.tx.id] = {
                                con: peerCon,
                                chans: {},
                                nextchanid: 1,
                                uuid: message.tx.id,
                                username: message.tx.username,
                            };
                            self.initializeCon(peerCon, message.tx.username, message.tx.id);

                            // Gather ICE candidates and send them to peer
                            peerCon.addEventListener("icecandidate", (e) => {
                                if (!e.candidate) return;

                                // Send the ICE offer to the host for relaying
                                chan.send(JSON.stringify({
                                    command: "discovery_ice",
                                    payload: e.candidate.toJSON(),
                                    rx: {
                                        id: message.tx.id,
                                        username: message.tx.username,
                                    },
                                }))
                            
                            });

                            // Create new data channel
                            peerChan = peerCon.createDataChannel("default", {
                                ordered: true,
                                negotiated: true,
                                id: 0,
                            });
                            self.cons[message.tx.id].chans['default'] = {
                                chan: peerChan,
                                lists: {},
                                vars: {},
                                cloudlists: {},
                                new: false,
                                value: "",
                            };
                            self.initializeDataChannel(peerChan, message.tx.id, message.tx.username);

                            // Get offer
                            offer = new RTCSessionDescription(message.payload);

                            // Set remote description
                            await peerCon.setRemoteDescription(offer);

                            // Generate answer
                            answer = await peerCon.createAnswer();

                            // Set local description
                            await peerCon.setLocalDescription(answer);

                            // Send answer to the host, host will relay answer to peer
                            chan.send(JSON.stringify({
                                command: "discovery_make_answer",
                                payload: peerCon.localDescription,
                                rx: {
                                    id: message.tx.id,
                                    username: message.tx.username,
                                },
                            }));
                        }

                        break;
                    
                    // If host, relay the answer. If peer, configure our connection using the answer.
                    case "discovery_make_answer":

                        // Relay message
                        if (this.mode == "host")  {
                            console.log(`Peer ${peerUsername} (${peerUUID}) made answer to ${message.rx.username} (${message.rx.id}), relaying answer`);

                            // Get peer
                            peerChan = self.cons[message.rx.id].chans['default'].chan;

                            // Relay offer to peer
                            peerChan.send(JSON.stringify({
                                command: "discovery_make_answer",
                                payload: message.payload,
                                tx: {
                                    id: peerUUID,
                                    username: peerUsername,
                                },
                            }));
                        }

                        // Configure connection using answer from peer
                        else if (this.mode == "peer") {
                            console.log(`Host ${peerUsername} (${peerUUID}) returned answer from ${message.tx.username} (${message.tx.id}), initializing connection`);
                            answer = new RTCSessionDescription(message.payload);

                            peerCon = self.cons[message.tx.id].con;

                            // Set local description
                            await peerCon.setRemoteDescription(answer);
                        }

                        break;
                    
                    // Create channel
                    case "newchan":
                        let tmpchan = self.cons[peerUUID].con.createDataChannel(message.payload.name, {
                            ordered: message.payload.ordered,
                            negotiated: true,
                            id: message.payload.id,
                        });

                        self.initializeDataChannel(tmpchan, peerUUID, peerUsername);

                        self.cons[peerUUID].chans[message.payload.name] = {
                            chan: tmpchan,
                            lists: {},
                            vars: {},
                            new: false,
                            value: "",
                        };

                        // Increment new channel ID
                        self.cons[peerUUID].nextchanid = (message.payload.id + 1);
                        break;
                        
                    // Close connection
                    case "goodbye":
                        await self.cons[peerUUID].con.close();
                        delete self.cons[peerUUID];
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnected.`);
                        break;
                    
                    // TODO: implement sending cloud lists
                    case "list":
                        break;

                    // Handle messages
                    case "data":
                        console.log('Got new data ', message.payload, ` from peer \"${peerUsername}\" (${peerUUID}) in channel \"${chan.label}\"`);

                        // Store the message
                        lists = self.cons[peerUUID].chans[String(chan.label)].lists;
                        variables = self.cons[peerUUID].chans[String(chan.label)].vars;

                        // Update lists
                        for (const key in lists) {
                            let list = lists[key];
                            let target = self.runtime.getTargetById((list.target));
                            if (!target) continue;
                            let tmp = target.lookupVariableByNameAndType(list.id, "list")
                            if (!tmp) continue;
                            tmp.value.push(self.makeValueScratchSafe(message.payload));
                            tmp._monitorUpToDate = false;
                        }

                        // Update variables
                        for (const key in variables) {
                            let variable = variables[key];
                            let target = self.runtime.getTargetById((variable.target));
                            if (!target) continue;
                            let tmp = target.lookupVariableByNameAndType(variable.id, "")
                            if (!tmp) continue;
                            tmp.value = self.makeValueScratchSafe(message.payload);
                        }

                        // Update state
                        self.cons[peerUUID].chans[String(chan.label)].value = message.payload;
                        self.cons[peerUUID].chans[String(chan.label)].new = true;
                        break;
                }
            }
            chan.onerror = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" error!`, e.error);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[String(chan.label)];
                }
            }
            chan.onclosing = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" closing...`);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[String(chan.label)];
                }
            }
            chan.onclose = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" closed!`);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[String(chan.label)];
                }
            }
        }

        initializeWebSocket(server, ugi) {
            const self = this;
            const signalingServerURL = `${server}signaling/${ugi}?v=0`;
            console.log(`Connecting to server: ${signalingServerURL}`);
            self.websocket = new WebSocket(signalingServerURL);

            self.websocket.onopen = () => {
                console.log(`Connected to server!`);

                // Tell the server the client exists
                self.sendSignallingMessage(self.signalingOpcodes.INIT, self.username);

                // Fire event hats
                self.runtime.startHats("dumb_on_signalling_connect");
            };

            self.websocket.onmessage = (event) => {
                let message = JSON.parse(event.data);
                self.handleSignalingMessage(message);
            };

            self.websocket.onclose = () => {
                console.log(`Disconnected from server!`);
                self.websocket = null;
                self.uuid = null;
                self.username = null;
                self.mode = null;
                self.newestPeer = {};
            }
        }

        async initializeAsHost(lobbyID, password, allowHostReclaim, allowPeersClaimHost, maxPeers) {
            const self = this;
            if (self.mode == "peer") return;
            self.mode = "host";

            // Send a signaling command to initialize as a host
            self.sendSignallingMessage(
                self.signalingOpcodes.CONFIG_HOST,
                {
                    lobby_id: lobbyID,
                    allow_host_reclaim: allowHostReclaim,
                    allow_peers_to_claim_host: allowPeersClaimHost,
                    password: password,
                    max_peers: maxPeers
                }
            );
        }

        async initializeAsPeer(lobbyID, password) {
            const self = this;
            if (self.mode == "host") return;
            self.mode = "peer";

            // Send a signaling command to initialize as a con
            self.sendSignallingMessage(
                self.signalingOpcodes.CONFIG_PEER,
                {
                    lobby_id: lobbyID,
                    password: password
                }
            );
        }

        sendSignallingMessage(opcode, payload, rx) {
            const self = this;
            if (!(self.websocket && self.websocket.readyState === WebSocket.OPEN)) return;
            let message = {
                opcode: opcode,
                payload: payload,
                rx: rx
            };
            self.websocket.send(JSON.stringify(message));
        }

        async handleSignalingMessage(message) {
            const self = this;
            // Placeholders
            let offer, answer, con, chan, peerUUID, peerUsername = null;

            // Handle various signaling messages and implement the negotiation process
            switch (message.opcode) {
                // Get session UUID for our client
                case self.signalingOpcodes.INIT_OK:
                    self.uuid = message.payload;
                    console.log(`Got a session UUID: ${self.uuid}`);
                    break;

                // Handle host mode request
                case self.signalingOpcodes.ACK_HOST:
                    console.log('Client is initialized as a host!');
                    break;

                // Handle con mode request
                case self.signalingOpcodes.ACK_PEER:
                    console.log('Client is initialized as a peer!');
                    break;

                // Handle host reclaim alerts
                case self.signalingOpcodes.HOST_RECLAIM:
                    if (self.uuid == message.payload.id) {
                        self.mode = "host";
                        console.log(`The server has made you the host of lobby \"${message.payload.lobby_id}\".`);
                    }
                    break;

                // Handle con join requests
                case self.signalingOpcodes.NEW_PEER:
                    if (self.mode != "host") return;

                    // Create con connection object and data channel
                    con = new RTCPeerConnection(self.configuration);
                    self.initializeCon(con, message.payload.username, message.payload.id);

                    // Gather ICE candidates and send them to peer
                    con.addEventListener("icecandidate", (e) => {
                        if (!e.candidate) return;
                        self.sendSignallingMessage(
                            self.signalingOpcodes.ICE,
                            e.candidate.toJSON(),
                            message.payload.id
                        )
                    });

                    chan = con.createDataChannel("default", {
                        ordered: true,
                        negotiated: true,
                        id: 0,
                    });

                    self.cons[message.payload.id] = {
                        con: con,
                        chans: {},
                        nextchanid: 1,
                        uuid: message.payload.id,
                        username: message.payload.username,
                    };

                    self.cons[message.payload.id].chans['default'] = {
                        chan: chan,
                        lists: {},
                        vars: {},
                        cloudlists: {},
                        new: false,
                        value: "",
                    };

                    self.initializeDataChannel(chan, message.payload.id, message.payload.username);

                    // Generate offer
                    offer = con.createOffer();

                    // Set local description
                    await con.setLocalDescription(offer);

                    // Send offer back to con
                    self.sendSignallingMessage(
                        self.signalingOpcodes.MAKE_OFFER,
                        con.localDescription,
                        message.payload.id
                    );
                    break;

                // Handle host offer
                case self.signalingOpcodes.MAKE_OFFER:
                    if (self.mode != "peer") return;
                    offer = new RTCSessionDescription(message.payload);

                    // Create con connection object and data channel
                    con = new RTCPeerConnection(self.configuration);
                    self.initializeCon(con, message.tx.username, message.tx.id);

                    // Gather ICE candidates and send them to peer
                    con.addEventListener("icecandidate", (e) => {
                        if (!e.candidate) return;
                        self.sendSignallingMessage(
                            self.signalingOpcodes.ICE,
                            e.candidate.toJSON(),
                            message.tx.id
                        )
                    });

                    chan = con.createDataChannel("default", {
                        ordered: true,
                        negotiated: true,
                        id: 0,
                    });

                    self.cons[message.tx.id] = {
                        con: con,
                        nextchanid: 1,
                        chans: {},
                        uuid: message.tx.id,
                        username: message.tx.username,
                    };

                    self.cons[message.tx.id].chans['default'] = {
                        chan: chan,
                        lists: {},
                        vars: {},
                        cloudlists: {},
                        new: false,
                        value: "",
                    };

                    self.initializeDataChannel(chan, message.tx.id, message.tx.username);

                    // Configure remote description
                    await con.setRemoteDescription(offer);

                    // Generate answer
                    answer = await con.createAnswer();

                    // Set local description
                    await con.setLocalDescription(answer);

                    // Send answer to host
                    self.sendSignallingMessage(
                        self.signalingOpcodes.MAKE_ANSWER,
                        con.localDescription,
                        message.tx.id
                    );
                    break;

                // Handle con answer
                case self.signalingOpcodes.MAKE_ANSWER:
                    if (self.mode != "host") return;
                    answer = new RTCSessionDescription(message.payload);

                    // Set local description
                    await self.cons[message.tx.id].con.setRemoteDescription(answer);
                    break;

                // Handle host ICE offers
                case self.signalingOpcodes.ICE:
                    if ((self.mode == "host") || (self.mode == "peer")) {
                        // Set ICE candidates from con
                        self.cons[message.tx.id].con.addIceCandidate(new RTCIceCandidate(message.payload));
                    }
                    break;
            }
        }

        get_new_peer(args, util) {
            const self = this;
            return self.makeValueScratchSafe(self.newestPeer);
        }

        get_client_mode(args, util) {
            const self = this;
            return self.makeValueScratchSafe(self.mode);
        }

        my_uuid(args, util) {
            const self = this;
            return self.makeValueScratchSafe(self.uuid);
        }

        initialize(args, util) {
            const self = this;

            // Initialize WebSocket connection
            if (!self.is_signalling_connected()) {
                self.username = args.USERNAME;
                self.initializeWebSocket(args.SERVER, encodeURI(args.UGI));
                return new Promise(r => {
                    self.websocket.addEventListener("open", r);
                    self.websocket.addEventListener("close", r);
                });
            }
        }

        on_channel_message(args, util) {
            const self = this;
            if (!self.cons.hasOwnProperty(args.PEER) || !self.cons[args.PEER].chans.hasOwnProperty(args.CHANNEL)) return false;
            if (self.cons[args.PEER].chans[args.CHANNEL].new) {
                self.cons[args.PEER].chans[args.CHANNEL].new = false;
                return true;
            }
            return false;
        }

        get_channel_data(args, util) {
            const self = this;
            return self.makeValueScratchSafe(self.cons[args.PEER].chans[args.CHANNEL].value);
        }

        is_signalling_connected(args, util) {
            const self = this;
            if (!self.websocket) return false;
            return (self.websocket.readyState === WebSocket.OPEN);
        }

        is_peer_connected(args, util) {
            const self = this;
            if (args.PEER in Object.keys(self.cons)) return true;
            return false;
        }

        get_peers(args, util) {
            const self = this;
            let peers = [];
            for (const uuid in self.cons) {
                if (self.cons.hasOwnProperty(uuid)) {
                    peers.push({
                        id: String(uuid),
                        username: String(self.cons[uuid].username),
                    });
                };
            };
            return self.makeValueScratchSafe(peers);
        }

        get_peer_channels(args, util) {
            const self = this;
            if (!self.cons[args.PEER]) {
                return "[]";
            };
            let channels = [];
            for (const chan in self.cons[args.PEER].chans) {
                channels.push(String(chan));
            };
            return self.makeValueScratchSafe(channels);
        }

        host(args, util) {
            const self = this;
            if (!self.is_signalling_connected()) return;

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

            self.initializeAsHost(
                args.LOBBY,
                args.PASSWORD,
                allowHostsReclaim,
                allowPeersClaimHost,
                args.PEERS
            );
        }

        peer(args, util) {
            const self = this;
            if (!self.is_signalling_connected()) return;
            self.initializeAsPeer(
                args.LOBBY,
                args.PASSWORD
            );
        }

        send(args, util) {
            const self = this;
            return new Promise(async(resolve, reject) => {
                let before;

                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };
                let message = {
                    command: "data",
                    payload: args.DATA
                };
                let chan = self.cons[args.PEER].chans[args.CHANNEL].chan;
                let username = self.cons[args.PEER].username;

                // If we want to wait for the message to send, get the current buffer size
                if (args.WAIT) {
                    before = chan.bufferedAmount;
                }

                chan.send(JSON.stringify(message));

                // Wait for the message to finish sending by awaiting the buffer flushing
                if (args.WAIT) {
                    chan.bufferedAmountLowThreshold = before;
                    await new Promise(r => chan.addEventListener("bufferedamountlow", r));
                }
                console.log('Sent', message, `to peer \"${username}\" (${args.PEER}) in channel \"${chan.label}\"`);
                resolve();
            })
        }

        channel_data_store_in_list(args, util) {
            const self = this;
            return new Promise((resolve, reject) => {

                // Remove this target from the object store
                if (String(args.LIST) == "null") {
                    delete self.cons[args.PEER].chans[args.CHANNEL].lists[util.target.id];
                    resolve();
                    return;
                }

                // Find and validate target
                let list = util.target.lookupVariableByNameAndType(String(args.LIST), "list");
                if (list) {
                    self.cons[args.PEER].chans[args.CHANNEL].lists[util.target.id] = {
                        target: util.target.id,
                        id: args.LIST,
                    };
                    resolve();
                
                } else reject(`List \"${args.LIST}\" not found.`);
            });
        }

        channel_data_store_in_variable(args, util) {
            const self = this;
            return new Promise((resolve, reject) => {
                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };

                // Remove this target from the object store
                if (String(args.VAR) == "null") {
                    delete self.cons[args.PEER].chans[args.CHANNEL].vars[util.target.id];
                    resolve();
                    return;
                }

                // Find and validate target
                let variable = util.target.lookupVariableByNameAndType(String(args.VAR), "");
                if (variable) {
                    self.cons[args.PEER].chans[args.CHANNEL].vars[util.target.id] = {
                        target: util.target.id,
                        id: args.VAR,
                    };
                    resolve();
                } else reject(`Variable \"${args.VAR}\" not found.`);
            });
        }

        newchan(args, util) {
            const self = this;
            return new Promise(async (resolve, reject) => {
                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };
                if (self.cons[args.PEER].chans.hasOwnProperty(String(args.CHANNEL))) {
                    reject(`Channel \"${args.CHANNEL}\" already exists!`);
                    return;
                };

                // Get ordered state
                let ordered = (args.ORDERED == "1");

                // Get next channel ID value
                let chanid = self.cons[args.PEER].nextchanid;

                // Get peer username
                let username = self.cons[args.PEER].username;

                // Create channel
                let chan = self.cons[args.PEER].con.createDataChannel(String(args.CHANNEL), {
                    ordered: ordered,
                    negotiated: true,
                    id: chanid,
                });
                self.cons[args.PEER].chans[String(args.CHANNEL)] = {
                    chan: chan,
                    lists: {},
                    vars: {},
                    new: false,
                    value: "",
                };
                self.initializeDataChannel(chan, args.PEER, username);

                // Tell peer to create a new data channel on their end
                let message = {
                    command: "newchan",
                    payload: {
                        id: chanid,
                        ordered: ordered,
                        name: String(args.CHANNEL),
                    }
                };
                self.cons[args.PEER].chans['default'].chan.send(
                    JSON.stringify(message)
                );

                // Increment new channel ID
                self.cons[args.PEER].nextchanid += 1;
                resolve();
            });
        }

        closechan(args, util) {
            const self = this;
            return new Promise(async (resolve, reject) => {
                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };
                if (!self.cons[args.PEER].chans.hasOwnProperty(String(args.CHANNEL))) {
                    reject(`Channel \"${args.CHANNEL}\" not found!`);
                    return;
                };
                if (String(args.CHANNEL).toLowerCase() == "default") {
                    reject(`Cannot destroy default channel! To close this connection, use the disconnect peer block.`);
                    return;
                };

                // Get channel object
                let chan = self.cons[args.PEER].chans[String(args.CHANNEL)].chan;

                // Close the channel and wait for it to close
                chan.close();
                await new Promise(e => chan.addEventListener("close", e));
                resolve();
            });
        }

        disconnect_peer(args, util) {
            const self = this;
            return new Promise(async (resolve, reject) => {
                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };

                // Get RTCPeerConnection object
                let con = self.cons[args.PEER].con;
                
                // Get default channel object
                let chan = self.cons[args.PEER].chans['default'].chan;

                // Tell peer we are going away and wait for the message to send
                let before = chan.bufferedAmount;
                chan.send(JSON.stringify({command: "goodbye"}));
                chan.bufferedAmountLowThreshold = before;
                await new Promise(r => chan.addEventListener("bufferedamountlow", r));

                // Close the connection
                let tmp = String(args.PEER);
                await con.close();
                delete self.cons[tmp];
                resolve();
            });
        }

        leave(args, util) {
            const self = this;
            return new Promise(async (resolve, reject) => {
                if (!self.is_signalling_connected()) {
                    resolve();
                    return;
                };
                
                // Gracefully close all peer connections
                for (const peer in self.cons) {

                    // Get RTCPeerConnection object
                    let con = self.cons[peer].con;

                    // Get default channel object
                    let chan = self.cons[peer].chans['default'].chan;

                    // Tell peer we are going away and wait for the message to send
                    let before = chan.bufferedAmount;
                    chan.send(JSON.stringify({command: "goodbye"}));
                    chan.bufferedAmountLowThreshold = before;
                    await new Promise(r => chan.addEventListener("bufferedamountlow", r));
                    
                    // Close the connection
                    let tmp = String(peer);
                    await con.close();
                    delete self.cons[tmp];
                }

                // Close connection to game server
                self.websocket.close();
                resolve();
            });
        }
    };

    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('dumb_on_channel_message');
    });

    Scratch.extensions.register(new dumb(Scratch));
    // vm.extensionManager._registerInternalExtension(new dumb(vm));
})(Scratch);