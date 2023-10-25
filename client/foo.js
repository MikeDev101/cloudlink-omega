(function (Scratch) {
    class CloudLinkOmega {
        constructor(Scratch) {
            this.vm = Scratch.vm; // vm
            this.runtime = this.vm.runtime;
            this.username = null;
            this.sessionId = null;
            this.websocket = null;
            this.peers = {};
            this.mode = null;
            this.hostIceSent = false;
            this.lobbyID = null;
            this.signalingServerURL = null;
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
            }

            this.blockIconURI =
                "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIxNzYuMzk4NTQiIGhlaWdodD0iMTIyLjY3MDY5IiB2aWV3Qm94PSIwLDAsMTc2LjM5ODU0LDEyMi42NzA2OSI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTE1MS44MDA3MywtMTE4LjY2NDY1KSI+PGcgZGF0YS1wYXBlci1kYXRhPSJ7JnF1b3Q7aXNQYWludGluZ0xheWVyJnF1b3Q7OnRydWV9IiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWRhc2hhcnJheT0iIiBzdHJva2UtZGFzaG9mZnNldD0iMCIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0yODYuMTIwMzcsMTU3LjE3NzU1YzIzLjI0MDg2LDAgNDIuMDc4OSwxOC44Mzk0NiA0Mi4wNzg5LDQyLjA3ODljMCwyMy4yMzk0NCAtMTguODM4MDMsNDIuMDc4OSAtNDIuMDc4OSw0Mi4wNzg5aC05Mi4yNDA3NGMtMjMuMjQwODYsMCAtNDIuMDc4OSwtMTguODM5NDYgLTQyLjA3ODksLTQyLjA3ODljMCwtMjMuMjM5NDQgMTguODM4MDMsLTQyLjA3ODkgNDIuMDc4OSwtNDIuMDc4OWg0LjE4ODg3YzEuODExNTMsLTIxLjU3MDU1IDE5Ljg5MzU3LC0zOC41MTI4OSA0MS45MzE1LC0zOC41MTI4OWMyMi4wMzc5MywwIDQwLjExOTk3LDE2Ljk0MjM0IDQxLjkzMTUsMzguNTEyODl6IiBmaWxsPSIjZmZmZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiLz48cGF0aCBkPSJNMjY5LjA3ODMzLDIxNy42MzQ5NGMwLDIuMzkzMzMgLTEuOTQwMDYsNC4zMzMzNyAtNC4zMzMzNyw0LjMzMzM3aC0xNS4zOTYwNGMtMi4zOTMzMywwIC00LjMzMzM3LC0xLjk0MDA1IC00LjMzMzM3LC00LjMzMzM3di05LjM1NDQ1YzAsLTEuNjc1MDYgMC45NjU0NywtMy4xOTk5OCAyLjQ3OTMzLC0zLjkxNjcyYzUuODkwNTcsLTIuNzg4MDkgOS42OTY3OSwtOC43OTc4MyA5LjY5Njc5LC0xNS4zMTAyNGMwLC05LjMzNDMgLTcuNTk0MjMsLTE2LjkyODUzIC0xNi45Mjg3NSwtMTYuOTI4NTNjLTkuMzM0NTIsMCAtMTYuOTI4NTMsNy41OTQyMyAtMTYuOTI4NTMsMTYuOTI4NTNjMCw2LjUxMjYyIDMuODA2MjIsMTIuNTIyMTQgOS42OTY3OSwxNS4zMTAyNGMxLjUxNDA4LDAuNzE2NTIgMi40Nzk1NiwyLjI0MTQ0IDIuNDc5NTYsMy45MTY3MnY5LjM1NDQ1YzAsMi4zOTMzMyAtMS45NDAwNiw0LjMzMzM3IC00LjMzMzM3LDQuMzMzMzdoLTE1LjM5NjQ3Yy0yLjM5MzMzLDAgLTQuMzMzMzcsLTEuOTQwMDUgLTQuMzMzMzcsLTQuMzMzMzdjMCwtMi4zOTMzMyAxLjk0MDA2LC00LjMzMzM3IDQuMzMzMzcsLTQuMzMzMzdoMTEuMDYzMXYtMi40NDk0NGMtMy4yNDMxLC0xLjk5ODEyIC02LjAwOTA5LC00LjY5OTc2IC04LjA5MzY2LC03LjkyNjgyYy0yLjY3MDg3LC00LjEzNDQ3IC00LjA4MjY4LC04LjkzMTA4IC00LjA4MjY4LC0xMy44NzE3N2MwLC0xNC4xMTMzNiAxMS40ODE5MiwtMjUuNTk1MjggMjUuNTk1MjcsLTI1LjU5NTI4YzE0LjExMzM2LDAgMjUuNTk1NSwxMS40ODE5MiAyNS41OTU1LDI1LjU5NTA2YzAsNC45NDA3IC0xLjQxMTgxLDkuNzM3NTIgLTQuMDgyNDcsMTMuODcxNzdjLTIuMDg0NTcsMy4yMjcwNiAtNC44NTAzNSw1LjkyODkyIC04LjA5MzY2LDcuOTI3MDR2Mi40NDk0NGgxMS4wNjI2N2MyLjM5MzMzLDAgNC4zMzMzNywxLjk0MDA2IDQuMzMzMzcsNC4zMzMzN3oiIGZpbGw9IiNmZjRkNGMiIGZpbGwtcnVsZT0ibm9uemVybyIvPjwvZz48L2c+PC9zdmc+PCEtLXJvdGF0aW9uQ2VudGVyOjg4LjE5OTI2OTk5OTk5OTk4OjYxLjMzNTM0NTAwMDAwMDAwNC0tPg==";

            this.menuIconURI =
                "data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHdpZHRoPSIyMjUuMzU0OCIgaGVpZ2h0PSIyMjUuMzU0OCIgdmlld0JveD0iMCwwLDIyNS4zNTQ4LDIyNS4zNTQ4Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMTI3LjMyMjYsLTY3LjMyMjYpIj48ZyBkYXRhLXBhcGVyLWRhdGE9InsmcXVvdDtpc1BhaW50aW5nTGF5ZXImcXVvdDs6dHJ1ZX0iIHN0cm9rZT0ibm9uZSIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiIHN0cm9rZS1saW5lam9pbj0ibWl0ZXIiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWRhc2hhcnJheT0iIiBzdHJva2UtZGFzaG9mZnNldD0iMCIgc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBub3JtYWwiPjxwYXRoIGQ9Ik0xMjcuMzIyNiwxODBjMCwtNjIuMjMwMDEgNTAuNDQ3MzksLTExMi42Nzc0IDExMi42Nzc0LC0xMTIuNjc3NGM2Mi4yMzAwMSwwIDExMi42Nzc0LDUwLjQ0NzM5IDExMi42Nzc0LDExMi42Nzc0YzAsNjIuMjMwMDEgLTUwLjQ0NzM5LDExMi42Nzc0IC0xMTIuNjc3NCwxMTIuNjc3NGMtNjIuMjMwMDEsMCAtMTEyLjY3NzQsLTUwLjQ0NzM5IC0xMTIuNjc3NCwtMTEyLjY3NzR6IiBmaWxsPSIjZmY0ZDRjIiBmaWxsLXJ1bGU9Im5vbnplcm8iIHN0cm9rZS13aWR0aD0iMCIvPjxwYXRoIGQ9Ik0yODUuODU3NDIsMTUxLjA4Mzg1YzIzLjI0MDg2LDAgNDIuMDc4OSwxOC44Mzk0NiA0Mi4wNzg5LDQyLjA3ODljMCwyMy4yMzk0NCAtMTguODM4MDMsNDIuMDc4OSAtNDIuMDc4OSw0Mi4wNzg5aC05Mi4yNDA3NGMtMjMuMjQwODYsMCAtNDIuMDc4OSwtMTguODM5NDYgLTQyLjA3ODksLTQyLjA3ODljMCwtMjMuMjM5NDQgMTguODM4MDMsLTQyLjA3ODkgNDIuMDc4OSwtNDIuMDc4OWg0LjE4ODg3YzEuODExNTMsLTIxLjU3MDU1IDE5Ljg5MzU3LC0zOC41MTI4OSA0MS45MzE1LC0zOC41MTI4OWMyMi4wMzc5MywwIDQwLjExOTk3LDE2Ljk0MjM0IDQxLjkzMTUsMzguNTEyODl6IiBmaWxsPSIjZmZmZmZmIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZS13aWR0aD0iMSIvPjxwYXRoIGQ9Ik0yNjguODE1MzcsMjExLjU0MTI1YzAsMi4zOTMzMiAtMS45NDAwNSw0LjMzMzM3IC00LjMzMzM3LDQuMzMzMzdoLTE1LjM5NjAzYy0yLjM5MzMyLDAgLTQuMzMzMzcsLTEuOTQwMDUgLTQuMzMzMzcsLTQuMzMzMzd2LTkuMzU0NDVjMCwtMS42NzUwNyAwLjk2NTQ4LC0zLjE5OTk4IDIuNDc5MzQsLTMuOTE2NzJjNS44OTA1NywtMi43ODgwOSA5LjY5Njc5LC04Ljc5NzgzIDkuNjk2NzksLTE1LjMxMDI0YzAsLTkuMzM0MyAtNy41OTQyMywtMTYuOTI4NTMgLTE2LjkyODc1LC0xNi45Mjg1M2MtOS4zMzQ1MiwwIC0xNi45Mjg1Myw3LjU5NDIzIC0xNi45Mjg1MywxNi45Mjg1M2MwLDYuNTEyNjIgMy44MDYyMiwxMi41MjIxNSA5LjY5Njc5LDE1LjMxMDI0YzEuNTE0MDgsMC43MTY1MiAyLjQ3OTU2LDIuMjQxNDQgMi40Nzk1NiwzLjkxNjcydjkuMzU0NDVjMCwyLjM5MzMyIC0xLjk0MDA1LDQuMzMzMzcgLTQuMzMzMzcsNC4zMzMzN2gtMTUuMzk2NDdjLTIuMzkzMzIsMCAtNC4zMzMzNywtMS45NDAwNSAtNC4zMzMzNywtNC4zMzMzN2MwLC0yLjM5MzMyIDEuOTQwMDUsLTQuMzMzMzcgNC4zMzMzNywtNC4zMzMzN2gxMS4wNjMxdi0yLjQ0OTQ0Yy0zLjI0MzA5LC0xLjk5ODEyIC02LjAwOTA5LC00LjY5OTc2IC04LjA5MzY2LC03LjkyNjgyYy0yLjY3MDg4LC00LjEzNDQ3IC00LjA4MjY5LC04LjkzMTA4IC00LjA4MjY5LC0xMy44NzE3OGMwLC0xNC4xMTMzNiAxMS40ODE5MiwtMjUuNTk1MjcgMjUuNTk1MjcsLTI1LjU5NTI3YzE0LjExMzM2LDAgMjUuNTk1NDksMTEuNDgxOTIgMjUuNTk1NDksMjUuNTk1MDZjMCw0Ljk0MDcgLTEuNDExODEsOS43Mzc1MiAtNC4wODI0NywxMy44NzE3OGMtMi4wODQ1NywzLjIyNzA2IC00Ljg1MDM0LDUuOTI4OTIgLTguMDkzNjYsNy45MjcwNHYyLjQ0OTQ0aDExLjA2MjY2YzIuMzkzMzIsMCA0LjMzMzM3LDEuOTQwMDUgNC4zMzMzNyw0LjMzMzM3eiIgZmlsbD0iI2ZmNGQ0YyIgZmlsbC1ydWxlPSJub256ZXJvIiBzdHJva2Utd2lkdGg9IjEiLz48L2c+PC9nPjwvc3ZnPjwhLS1yb3RhdGlvbkNlbnRlcjoxMTIuNjc3Mzk5OTk5OTk5OTk6MTEyLjY3NzQtLT4=";
        }

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
                        text: "When I get connected to game",
                        isEdgeActivated: false,
                    },
                    {
                        opcode: "on_channel_message",
                        blockType: "hat",
                        text: "When I receive new message from peer [PEER] in channel [CHANNEL]",
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
                    {
                        opcode: 'is_signalling_connected',
                        blockType: 'Boolean',
                        text: 'Connected to game?',
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
                                defaultValue: 'UGI',
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
                        text: 'Send data [DATA] Peer: [PEER] Channel: [CHANNEL] ',
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
                    {
                        opcode: 'closechan',
                        blockType: 'command',
                        text: 'Close data channel: [CHANNEL] Peer: [PEER]',
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

        startClient(username, ugi) {
            this.username = username;

            // Initialize WebSocket connection
            this.initializeWebSocket(encodeURI(ugi));
        }

        async initializePeer(uuid) {
            // Create RTCPeerConnection and store it in our class
            const con = new RTCPeerConnection(this.configuration);
            this.peers[uuid] = {
                con: con,
                channels: {},
                channelData: {},
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
                this.initializeDataChannel(event.channel, uuid);
            }

            con.onconnectionstatechange = () => {
                switch (con.connectionState) {
                    case "new":
                        break;
                    case "connecting":
                        console.log(`Peer ${uuid} is connecting...`);
                        break;
                    case "connected":
                        console.log(`Peer ${uuid} is connected!`);
                        break;
                    case "disconnected":
                        console.log(`Peer ${uuid} is disconnecting...`);
                        break;
                    case "closed":
                        console.log(`Peer ${uuid} has disconnected.`);
                        break;
                    case "failed":
                        console.warn(`Peer ${uuid} connection failed!`);
                        break;
                    default:
                        console.error(`Peer ${uuid} connection state unknown!`);
                        break;
                }
            }
        }

        initializeDataChannel(chan, uuid) {
            const channelName = chan.label;
            const isOrdered = chan.ordered;

            chan.onopen = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" opened! Is this channel ordered: ${isOrdered}`);

                // Check if channel exists, and create reference it if it does not exist (in-band WebRTC channel creation).
                if (!this.peers[uuid].channels.hasOwnProperty(channelName)) {
                    console.log(`Created channel reference for peer  ${uuid} with name \"${channelName}\".`);
                    this.peers[uuid].channels[channelName] = chan;
                    this.peers[uuid].channelData[channelName] = {
                        value: "",
                        new: false,
                    };
                }
            }

            chan.onmessage = (e) => {
                this.peers[uuid].channelData[channelName] = {
                    value: e.data,
                    new: true,
                };
            }

            chan.onerror = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" error!`, e.error);
            }

            chan.onclosing = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" closing...`);
            }

            chan.onclose = (e) => {
                console.log(`Peer ${uuid} channel \"${channelName}\" closed!`);
                console.log(this.peers[uuid]);
                delete (this.peers[uuid].channels[channelName]);
                delete (this.peers[uuid].channelData[channelName]);
                console.log(this.peers[uuid]);
                console.log(`Deleted channel reference for peer ${uuid} with name \"${channelName}\".`);
            }
        }

        initializeWebSocket(ugi) {
            const signalingServerURL = `ws://127.0.0.1:3000/signaling/${ugi}?v=0`;
            console.log(`Connecting to signalling backend: ${signalingServerURL}`);
            this.websocket = new WebSocket(signalingServerURL);

            this.websocket.onopen = () => {
                console.log(`Connected to signalling backend!`);
                this.runtime.startHats("cloudlinkomega_on_signalling_connect");
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
            let uuid, offer, answer, con, temp, channels, channelData = null;

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
                    await this.initializePeer(uuid);

                    // Generate data channel
                    this.peers[uuid].channels['default'] = con.createDataChannel('default', { ordered: true });
                    this.peers[uuid].channelData['default'] = {
                        value: "",
                        new: false,
                    };

                    // Generate offer
                    offer = await this.peers[uuid].con.createOffer();

                    // Set local description
                    await this.peers[uuid].con.setLocalDescription(offer);

                    // Send offer back to con
                    this.sendSignallingMessage(
                        this.signalingOpcodes.MAKE_OFFER,
                        this.peers[uuid].con.localDescription,
                        uuid
                    )
                    break;

                // Handle host offer TODO: refactor, see above
                case this.signalingOpcodes.MAKE_OFFER:
                    if (this.mode != "peer") return;
                    uuid = message.tx;
                    offer = new RTCSessionDescription(message.payload);

                    // Create con connection object
                    temp = await this.initializePeer(uuid);
                    con = temp.con;
                    channels = temp.channels;
                    channelData = temp.channelData;

                    // Generate data channel
                    channels['default'] = con.createDataChannel('default', { ordered: true });
                    channelData['default'] = {
                        value: "",
                        new: false,
                    };

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

        on_channel_message(args) {
            if (this.isSignallingConnected
                && this.peers.hasOwnProperty(args.PEER)
                && this.peers[args.PEER].channelData.hasOwnProperty(args.CHANNEL)
                && this.peers[args.PEER].channelData[args.CHANNEL].new
            ) {
                this.peers[args.PEER].channelData[args.CHANNEL].new = false;
                return true;
            } else {
                return false;
            }
        }

        get_channel_data(args) {
            return new Promise((resolve) => {
                if (this.isSignallingConnected
                    && this.peers.hasOwnProperty(args.PEER)
                    && this.peers[args.PEER].channelData.hasOwnProperty(args.CHANNEL)
                ) {
                    resolve(this.makeValueScratchSafe(this.peers[args.PEER].channelData[args.CHANNEL].value));
                } else {
                    resolve("");
                }
            });
        }

        is_signalling_connected() {
            return new Promise((resolve) => {
                if (this.websocket
                    && this.isSignallingConnected()
                ) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        }

        is_peer_connected() {
            return new Promise((resolve) => {
                if (this.websocket
                    && this.isSignallingConnected()
                ) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        }

        get_peers() {
            if (!this.isSignallingConnected()) return "[]";
            return this.makeValueScratchSafe(this.getPeers());
        }

        initalize(args) {
            if (!this.websocket) return this.startClient(args.USERNAME, args.UGI);
        }

        host(args) {
            if (!this.isSignallingConnected()) return;

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

            this.initializeAsHost(args.LOBBY, args.PASSWORD, allowHostsReclaim, allowPeersClaimHost, args.PEERS);
        }

        peer(args) {
            if (!this.isSignallingConnected()) return;
            this.initializeAsPeer(args.LOBBY, args.PASSWORD);
        }

        send(args) {
            return new Promise(async (resolve) => {
                if (this.isSignallingConnected()
                    && this.peers.hasOwnProperty(args.PEER)
                    && this.peers[args.PEER].channels.hasOwnProperty(args.CHANNEL)
                ) {
                    // Send message and wait for it to finish sending
                    const before = this.peers[args.PEER].bufferedAmount;
                    this.peers[args.PEER].channels[args.CHANNEL].send(args.DATA);
                    this.peers[args.PEER].channels[args.CHANNEL].bufferedAmountLowThreshold = before;
                    await new Promise(r => this.peers[args.PEER].channels[args.CHANNEL].addEventListener("bufferedamountlow", r));
                    resolve();
                } else {
                    resolve();
                }
            });
        }

        newchan(args) {
            return new Promise(async (resolve) => {
                if (this.isSignallingConnected()
                    && this.peers.hasOwnProperty(args.PEER)
                    && !this.peers[args.PEER].channels.hasOwnProperty(args.CHANNEL)
                ) {
                    let ordered = (args.CHANNELCONFIG == "1");

                    // Create incoming channel
                    this.peers[args.PEER].channels[args.CHANNEL] = await this.peers[args.PEER].con.createDataChannel(args.CHANNEL, { ordered: ordered });
                    this.peers[args.PEER].channelData[args.CHANNEL] = {
                        value: "",
                        new: false,
                    };

                    // Create outgoing channel
                    this.peers[this.uuid].channels[args.CHANNEL] = await this.peers[this.uuid].con.createDataChannel(args.CHANNEL, { ordered: ordered });
                    this.peers[this.uuid].channelData[args.CHANNEL] = {
                        value: "",
                        new: false,
                    };
                    resolve();
                } else {
                    resolve();
                }
            });
        }
        closechan(args) {
            return new Promise(async (resolve) => {
                if (this.isSignallingConnected()
                    && this.peers.hasOwnProperty(args.PEER)
                    && this.peers[args.PEER].channels.hasOwnProperty(args.CHANNEL)
                ) {
                    this.peers[args.PEER].channels[args.CHANNEL].close();
                    await new Promise(r => this.peers[args.PEER].channels[args.CHANNEL].addEventListener("close", r));
                    resolve();
                } else {
                    resolve();
                }
            });
        }
    };

    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('cloudlinkomega_on_channel_message');
    });

    Scratch.extensions.register(new CloudLinkOmega(Scratch));
    // vm.extensionManager._registerInternalExtension(new CloudLinkOmega(vm));
})(Scratch);