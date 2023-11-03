(function (Scratch) {
    class CloudLinkOmega {
        constructor(Scratch) {
            this.vm = Scratch.vm; // VM
            this.runtime = Scratch.vm.runtime; // Runtime
            this.targets = Scratch.vm.runtime.targets // Access variables
            this.uuid = null;
            this.username = null;
            this.websocket = null;
            this.keepalive = null;
            this.cons = {};
            this.mode = null;
            this.newestPeer = {};
            this.lobbyID = null;
            this.hostPeer = null;
            this.hasMicPerms = false;
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
                                defaultValue: 'UUID',
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
        
        // Makes a value safe for the Scratch VM to use.
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

        // Provide a common function for creating a WebRTC peer connection object.
        createConnectionObject(peerUUID, peerUsername) {
            const self = this;
            let con = new RTCPeerConnection(self.configuration);
            self.initializeCon(con, peerUsername, peerUUID);
            self.cons[peerUUID] = {
                con: con,
                chans: {},
                vchan: null,
                vstream: null,
                nextchanid: 1,
                uuid: peerUUID,
                username: peerUsername,
            };
            return self.getConnectionObject(peerUUID);
        }

        // Provide a common function for getting a WebRTC peer connection object.
        getConnectionObject(peerUUID) {
            const self = this;
            return self.getConnectionState(peerUUID).con;
        }

        // Provide a common function for getting a WebRTC peer connection data/states.
        getConnectionState(peerUUID) {
            const self = this;
            return self.cons[peerUUID];
        }

        // Provide a common function for creating a WebRTC data channel.
        createChannelObject(channelName, channelID, channelOrdered, peerUUID, peerUsername) {
            const self = this;
            let con = self.getConnectionObject(peerUUID);
            let chan = con.createDataChannel(
                channelName,
                {
                    ordered: channelOrdered,
                    negotiated: true,
                    id: channelID,
                }
            );
            self.cons[peerUUID].chans[channelName] = {
                chan: chan,
                lists: {},
                vars: {},
                networked_lists: {},
                new: false,
                value: "",
            };
            self.initializeDataChannel(chan, con, peerUUID, peerUsername);
            return self.getChannelObject(channelName, peerUUID);
        }

        // Provide a common function for accessing channel data/states.
        getChannelState(channelName, peerUUID) {
            const self = this;
            return self.cons[peerUUID].chans[channelName];
        }

        // Provide a common function for accessing a WebRTC data channel.
        getChannelObject(channelName, peerUUID) {
            const self = this;
            return self.getChannelState(channelName, peerUUID).chan;
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

            // Log voice channel creation
            con.onaddstream = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) opened voice chat!`);
                const audioElement = document.createElement(`audio`);
                audioElement.id = String(peerUUID);
                audioElement.srcObject = e.stream;
                audioElement.controls = true;
                audioElement.autoplay = true;
                document.body.appendChild(audioElement);
                audioElement.play();
            };  
        }

        initializeDataChannel(chan, con, peerUUID, peerUsername) {
            const self = this;

            chan.onopen = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" opened! Is this channel ordered: ${chan.ordered}, ID: ${chan.id}`);

                // Broadcast fully connected state
                if (chan.label == "default") {
                    self.runtime.startHats("cloudlinkomega_on_new_peer");
                }

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
                let peerCon, variables, lists = null;

                // Log channel incoming messages
                console.log(message);

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
                        
                        // Get discovered peer and relay request to discovered peer
                        self.getChannelObject(
                            "default",
                            String(message.payload.id)
                        ).send(JSON.stringify({
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
                        peerCon = self.createConnectionObject(
                            String(message.payload.id),
                            String(message.payload.username)
                        );

                        // Create new data channel
                        self.createChannelObject(
                            "default",
                            0,
                            true,
                            String(message.payload.id),
                            String(message.payload.username)
                        );

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

                        // Generate offer and set local description
                        await peerCon.setLocalDescription(
                            await peerCon.createOffer()
                        );

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

                            // Get discovered peer and relay request to discovered peer
                            self.getChannelObject(
                                "default",
                                String(message.rx.id)
                            ).send(JSON.stringify({
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

                            // Get discovered peer and set ICE candidate
                            self.getConnectionObject(
                                String(message.tx.id)
                            ).addIceCandidate(
                                new RTCIceCandidate(message.payload)
                            );
                        }

                        break;
                    
                    // If host, relay the offer. If peer, create our own peer connection and send back answer.
                    case "discovery_make_offer":

                        // Relay message
                        if (this.mode == "host")  {
                            console.log(`Peer ${peerUsername} (${peerUUID}) made offer to ${message.rx.username} (${message.rx.id}), relaying offer`);

                            // Get discovered peer and relay offer to discovered peer
                            self.getChannelObject(
                                "default",
                                String(message.rx.id)
                            ).send(JSON.stringify({
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
                            peerCon = self.createConnectionObject(
                                String(message.tx.id),
                                String(message.tx.username)
                            );

                            // Create new data channel
                            self.createChannelObject(
                                "default",
                                0,
                                true,
                                String(message.tx.id),
                                String(message.tx.username)
                            );

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

                            // Get offer and set remote description
                            await peerCon.setRemoteDescription(
                                new RTCSessionDescription(message.payload)
                            );

                            // Generate answer and set local description
                            await peerCon.setLocalDescription(
                                await peerCon.createAnswer()
                            );

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

                            // Get discovered peer and relay answer to discovered peer
                            self.getChannelObject(
                                "default",
                                String(message.rx.id)
                            ).send(JSON.stringify({
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
                            
                            // Set local description
                            await self.getConnectionObject(
                                String(message.tx.id)
                            ).setRemoteDescription(
                                new RTCSessionDescription(message.payload)
                            );
                        }

                        break;
                    
                    // Create channel
                    case "new_dchan":
                        self.createChannelObject(
                            String(message.payload.name),
                            message.payload.id,
                            message.payload.ordered,
                            String(peerUUID),
                            String(peerUsername)
                        );

                        // Increment new channel ID
                        self.cons[peerUUID].nextchanid = (message.payload.id + 1);
                        break;
                        
                    // Close connection
                    case "goodbye":
                        delete self.cons[peerUUID];
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnected.`);
                        break;
                    
                    // Implement sending networked lists
                    case "list":
                        console.log('Got new networked list ', message.payload.id, ` with value `, message.payload.value, `from peer \"${peerUsername}\" (${peerUUID}) in channel \"${chan.label}\"`);
                        
                        // Store the data
                        let networked_lists = self.getChannelState(chan.label, peerUUID).networked_lists;
                        let list = networked_lists[message.payload.id];

                        if (!list) {
                            console.log(`Networked list ${message.payload.id} not declared in client`);
                            return;
                        };

                        // Get list
                        let target = self.runtime.getTargetById(list.target);
                        let tmp = target.lookupVariableByNameAndType(list.id, "list");

                        // Update value
                        tmp.value = message.payload.value;
                        tmp._monitorUpToDate = false;
                        
                        break;

                    // Handle messages
                    case "data":
                        console.log('Got new data ', message.payload, ` from peer \"${peerUsername}\" (${peerUUID}) in channel \"${chan.label}\"`);

                        // Store the message
                        lists = self.getChannelState(chan.label, peerUUID).lists;
                        variables = self.getChannelState(chan.label, peerUUID).vars;

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
                        self.getChannelState(chan.label, peerUUID).value = message.payload;
                        self.getChannelState(chan.label, peerUUID).new = true;
                        break;
                }
            }
            chan.onerror = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" error!`, e.error);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[chan.label];
                }
            }
            chan.onclosing = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" closing...`);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[chan.label];
                }
            }
            chan.onclose = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${chan.label}\" closed!`);
                // Destroy channel reference
                if (self.cons[peerUUID] && self.cons[peerUUID].chans[String(chan.label)]) {
                    delete self.cons[peerUUID].chans[chan.label];
                }
            }
        }

        initializeWebSocket(server, ugi) {
            const self = this;

            // Get server URL. TODO: Use URL object
            const signalingServerURL = `${server}signaling/${ugi}?v=0`;
            console.log(`Connecting to server: ${signalingServerURL}`);

            // Connect to game server
            self.websocket = new WebSocket(signalingServerURL);

            // Handle connect
            self.websocket.onopen = () => {
                console.log(`Connected to server!`);

                // Tell the server the client exists
                self.sendSignallingMessage(self.signalingOpcodes.INIT, self.username);

                // Fire event hats
                self.runtime.startHats("cloudlinkomega_on_signalling_connect");

                // Create keepalive
                self.keepalive = setInterval(() => {
                    if (self.websocket && self.websocket.readyState === WebSocket.OPEN) {
                        self.sendSignallingMessage(
                            self.signalingOpcodes.KEEPALIVE
                        );
                    }
                }, 30000); // Send the keepalive message every 30 seconds
            };

            // Handle messages
            self.websocket.onmessage = (event) => {
                // Log incoming messages
                let message = JSON.parse(event.data);
                console.log(message);
                self.handleSignalingMessage(message);
            };

            // Handle closure/disconnect
            self.websocket.onclose = async() => {
                console.log(`Disconnected from server!`);
                
                // Clear keepalive
                clearInterval(self.keepalive);
                self.keepalive = null;

                // Gracefully close all peer connections
                for (const peer in self.cons) {

                    // Get RTCPeerConnection object
                    let con = self.getConnectionObject(String(peer));

                    // Get default channel object
                    let chan = self.getChannelObject("default", String(peer));

                    // Tell peer we are going away and wait for the message to send
                    let before = chan.bufferedAmount;
                    chan.send(JSON.stringify({command: "goodbye"}));
                    chan.bufferedAmountLowThreshold = before;
                    await new Promise(r => chan.addEventListener("bufferedamountlow", r));
                    
                    // Close the connection
                    let tmp = String(peer);
                    await con.close();
                    delete self.cons[tmp];
                };

                // Reset values
                self.websocket = null;
                self.uuid = null;
                self.username = null;
                self.mode = null;
                self.newestPeer = {};
                self.hostPeer = null;
                self.lobbyID = null;
            }
        }

        async initializeAsHost(lobbyID, password, allowHostReclaim, allowPeersClaimHost, maxPeers) {
            const self = this;
            if ((self.mode == "peer") || (self.mode == "configuring")) return;
            self.mode = "configuring";
            self.lobbyID = String(lobbyID);

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
            if ((self.mode == "host") || (self.mode == "configuring")) return;
            self.mode = "configuring";
            self.lobbyID = String(lobbyID);

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
            self.websocket.send(JSON.stringify({
                opcode: opcode,
                payload: payload,
                rx: rx
            }));
        }

        async handleSignalingMessage(message) {
            const self = this;
            let con = null;

            // Handle various signaling messages and implement the negotiation process
            switch (message.opcode) {

                // Get session UUID for our client
                case self.signalingOpcodes.INIT_OK:
                    if (self.mode != null) return;
                    self.uuid = message.payload;
                    console.log(`Game server has generated a session UUID: ${self.uuid}`);
                    break;

                // Handle host mode request
                case self.signalingOpcodes.ACK_HOST:
                    if (self.mode != "configuring") return;
                    self.mode = "host";
                    console.log(`Client is now operating as a host. Hosting lobby \"${self.lobbyID}\".`);
                    break;

                // Handle con mode request
                case self.signalingOpcodes.ACK_PEER:
                    if (self.mode != "configuring") return;
                    self.mode = "peer";
                    console.log('Client is now operating as a peer.');
                    break;
                
                // Handle lobby exists
                case self.signalingOpcodes.LOBBY_EXISTS:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot create lobby \"${self.lobbyID}\": Lobby already exists.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;
                
                // Handle lobby not found
                case self.signalingOpcodes.LOBBY_NOTFOUND:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot join lobby \"${self.lobbyID}\": Lobby not found.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;
                
                // Handle lobby password required
                case self.signalingOpcodes.PASSWORD_REQUIRED:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot join lobby \"${self.lobbyID}\": Password required.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;
                
                // Handle lobby password invalid
                case self.signalingOpcodes.PASSWORD_FAIL:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot join lobby \"${self.lobbyID}\": Password invalid.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;
                
                // Handle lobby full
                case self.signalingOpcodes.LOBBY_FULL:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot join lobby \"${self.lobbyID}\": Lobby is full.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;
                
                // Handle lobby locked
                case self.signalingOpcodes.LOBBY_LOCKED:
                    if (self.mode != "configuring") return;
                    console.log(`Cannot join lobby \"${self.lobbyID}\": Lobby is locked, access denied.`);
                    self.mode = null;
                    self.lobbyID = null;
                    break;

                // Handle host reclaim alerts
                case self.signalingOpcodes.HOST_RECLAIM:
                    if (self.mode != "peer") return;
                    if (self.uuid == message.payload.id) {
                        self.mode = "host";
                        self.hostPeer = null;
                        console.log(`The game server has made you the host of lobby \"${message.payload.lobby_id}\". Client is now operating as a host.`);
                    }
                    break;
                
                // Handle lobby closure
                case self.signalingOpcodes.LOBBY_CLOSE:
                    if (self.mode != "peer") return;
                    console.log(`The game server has closed the lobby \"${message.payload}\". Disconnecting from the game server.`);

                    // Delete host object
                    delete self.cons[self.hostPeer];
                    self.hostPeer = null;

                    // Close the connection to the server
                    self.leave();
                    break;

                // Handle con join requests
                case self.signalingOpcodes.NEW_PEER:
                    if (self.mode != "host") return;

                    // Create con connection object
                    con = self.createConnectionObject(
                        String(message.payload.id),
                        String(message.payload.username),
                    );

                    // Create data channel
                    self.createChannelObject(
                        "default",
                        0,
                        true,
                        String(message.payload.id),
                        String(message.payload.username)
                    );

                    // Gather ICE candidates and send them to peer
                    con.addEventListener("icecandidate", (e) => {
                        if (!e.candidate) return;
                        self.sendSignallingMessage(
                            self.signalingOpcodes.ICE,
                            e.candidate.toJSON(),
                            String(message.payload.id)
                        )
                    });

                    // Generate offer and set local description
                    await con.setLocalDescription(
                        con.createOffer()
                    );

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

                    // Create con connection object
                    con = self.createConnectionObject(
                        String(message.tx.id),
                        String(message.tx.username),
                    );

                    // Set host peer
                    self.hostPeer = String(message.tx.id);

                    // Create data channel
                    self.createChannelObject(
                        "default",
                        0,
                        true,
                        String(message.tx.id),
                        String(message.tx.username)
                    );

                    // Gather ICE candidates and send them to peer
                    con.addEventListener("icecandidate", (e) => {
                        if (!e.candidate) return;
                        self.sendSignallingMessage(
                            self.signalingOpcodes.ICE,
                            e.candidate.toJSON(),
                            String(message.tx.id)
                        )
                    });

                    // Configure remote description
                    await con.setRemoteDescription(
                        new RTCSessionDescription(message.payload)
                    );

                    // Generate answer and set local description
                    await con.setLocalDescription(
                        await con.createAnswer()
                    );

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
                    
                    // Set local description
                    await self.getConnectionObject(
                        String(message.tx.id)
                    ).setRemoteDescription(
                        new RTCSessionDescription(message.payload)
                    );

                    break;

                // Handle host ICE offers
                case self.signalingOpcodes.ICE:
                    if ((self.mode == "host") || (self.mode == "peer")) {

                        // Set ICE candidates from con
                        self.getConnectionObject(
                            String(message.tx.id)
                        ).addIceCandidate(
                            new RTCIceCandidate(message.payload)
                        );
                        
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

        on_dchan_message(args, util) {
            const self = this;
            if (!self.cons.hasOwnProperty(args.PEER) || !self.cons[args.PEER].chans.hasOwnProperty(args.CHANNEL)) return false;
            if (self.cons[args.PEER].chans[args.CHANNEL].new) {
                self.cons[args.PEER].chans[args.CHANNEL].new = false;
                return true;
            }
            return false;
        }

        on_channel_networked_list(args, util) {
            const self = this;
            // stub
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

        init_host_mode(args, util) {
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

        init_peer_mode(args, util) {
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

                let username = self.cons[args.PEER].username;
                let chan = self.getChannelObject(
                    String(args.CHANNEL),
                    String(args.PEER)
                );

                // If we want to wait for the message to send, get the current buffer size
                if (args.WAIT) {
                    before = chan.bufferedAmount;
                }

                let message = {
                    command: "data",
                    payload: args.DATA
                };

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

        send_networked_list(args, util) {
            const self = this;
            return new Promise(async(resolve, reject) => {
                let before;
                let username = self.cons[args.PEER].username;
                let chan = self.getChannelObject(
                    String(args.CHANNEL),
                    String(args.PEER)
                );
                
                let list = self.getChannelState(
                    String(args.CHANNEL),
                    String(args.PEER)
                ).networked_lists[String(args.LISTNAME)];

                if (!list) {
                    reject(`List ${args.LISTNAME} not found!`);
                    return;
                }

                // Get list
                let target = self.runtime.getTargetById(list.target);
                let tmp = target.lookupVariableByNameAndType(list.id, "list");

                // Send value
                // If we want to wait for the message to send, get the current buffer size
                if (args.WAIT) {
                    before = chan.bufferedAmount;
                }

                let message = {
                    command: "list",
                    payload: {
                        id: String(args.LISTNAME),
                        value: tmp.value,
                    }
                };

                chan.send(JSON.stringify(message));

                // Wait for the message to finish sending by awaiting the buffer flushing
                if (args.WAIT) {
                    chan.bufferedAmountLowThreshold = before;
                    await new Promise(r => chan.addEventListener("bufferedamountlow", r));
                }
                console.log('Sent', message, `to peer \"${username}\" (${args.PEER}) in channel \"${chan.label}\"`);
                resolve();
            });
        }

        make_networked_list(args, util) {
            const self = this;
            return new Promise((resolve, reject) => {

                // Remove this target from the object store
                if (String(args.LISTNAME) == "null") {
                    delete self.getChannelState(
                        String(args.CHANNEL),
                        String(args.PEER)
                    ).networked_lists[String(args.LISTNAME)];
                    resolve();
                    return;
                }

                // Find and validate target
                let list = util.target.lookupVariableByNameAndType(String(args.LIST), "list");
                if (!list) {
                    reject(`List \"${args.LIST}\" not found.`);
                    return;
                };

                // Create entry
                self.getChannelState(
                    String(args.CHANNEL),
                    String(args.PEER)
                ).networked_lists[String(args.LISTNAME)] = {
                    target: util.target.id,
                    id: String(args.LIST),
                    new: false,
                };

                resolve();
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

        new_dchan(args, util) {
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

                // Create channel
                self.createChannelObject(
                    String(args.CHANNEL),
                    self.cons[String(args.PEER)].nextchanid,
                    (args.ORDERED == "1"),
                    String(args.PEER),
                    self.cons[String(args.PEER)].username
                );

                // Tell peer to create a new data channel on their end
                self.getChannelObject(
                    'default',
                    String(args.PEER)
                ).send(
                    JSON.stringify({
                        command: "new_dchan",
                        payload: {
                            id: self.cons[String(args.PEER)].nextchanid,
                            ordered: (args.ORDERED == "1"),
                            name: String(args.CHANNEL),
                        }
                    })
                );

                // Increment new channel ID
                self.cons[String(args.PEER)].nextchanid += 1;
                resolve();
            });
        }

        close_dchan(args, util) {
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
                let chan = self.getChannelObject(String(args.CHANNEL), String(args.PEER));

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
                let con = self.getConnectionObject(String(args.PEER));
                
                // Get default channel object
                let chan = self.getChannelObject("default", String(args.PEER));

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
                    let con = self.getConnectionObject(String(peer));

                    // Get default channel object
                    let chan = self.getChannelObject("default", String(peer));

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

        // Request microphone permission
        async request_mic_perms(args, util) {
            const self = this;
            self.hasMicPerms = false;
            // Try to get microphone permission
            try {
                await navigator.mediaDevices.getUserMedia({audio: true});
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

        is_peer_vchan_open(args, util) {
            const self = this;
            let vchan = self.getConnectionObject(args.PEER).vchan;
            return ((vchan != null) && (vchan.readyState == "live"));
        }

        change_mic_state(args, util) {
            const self = this;
            let peer = self.getConnectionObject(args.PEER);
            peer.vstream.enabled = (args.MICSTATE == "2");
        }

        async new_vchan(args, util) {
            const self = this;
            let peer = self.getConnectionObject(args.PEER);
            peer.vstream = new MediaStream(
                await navigator.mediaDevices.getUserMedia({audio: true})
            );
            peer.con.addStream(peer.vstream);
        }

        close_vchan(args, util) {
            const self = this;
            let peer = self.getConnectionObject(args.PEER);
            peer.vstream.getTracks().forEach((track) => track.stop());
        }
    };

    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('cloudlinkomega_on_dchan_message');
        Scratch.vm.runtime.startHats('cloudlinkomega_on_channel_networked_list');
    });

    Scratch.extensions.register(new CloudLinkOmega(Scratch));
    // vm.extensionManager._registerInternalExtension(new CloudLinkOmega(vm));
})(Scratch);