(function (Scratch) {
    class CloudLinkOmega {
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
                                defaultValue: 'ws://127.0.0.1:3000/',
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
                        text: 'Send data [DATA] to peer [PEER] using channel [CHANNEL]',
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
                        text: "When I get a cloud list named [LISTNAME] from peer [PEER] in channel [CHANNEL]",
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
                        text: "Send cloud list [LISTNAME] to peer [PEER] using channel [CHANNEL]",
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
                        text: "Make list [LIST] a cloud list named [LISTNAME]",
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
                        text: 'Open a new data channel named [CHANNEL] with peer [PEER] and make messages [CHANNELCONFIG]',
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

        initializeCon(con, peerUsername, peerUUID, inBandICE) {
            const self = this;

            if (!inBandICE) {
                // Gather ICE candidates and send them to peer
                con.onicecandidate = (e) => {
                    if (!e.candidate) return;
                    self.sendSignallingMessage(
                        self.signalingOpcodes.ICE,
                        e.candidate.toJSON(),
                        peerUUID,
                    )
                }
            }

            // Log ICE gathering events
            con.onicegatheringstatechange = (e) => {
                switch (e.target.iceGatheringState) {
                    case "gathering":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) ICE is now gathering candidates...`);
                        break;
                    case "complete":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) ICE has finished gathering candidates!`)
                        break;
                }
            };

            // handle error
            con.onicecandidateerror = (e) => {
                console.warn(`Peer \"${peerUsername}\" (${peerUUID}) ICE error on URL \"`, e.url, "\": ", e.errorText);
            };

            // Log connection state changes
            con.onconnectionstatechange = (e) => {
                switch (con.connectionState) {
                    case "new":
                        break;
                    case "connecting":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) connecting...`);
                        break;
                    case "connected":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) connected!`);
                        self.newestPeer = { [String(peerUsername)]: String(peerUUID) };
                        self.runtime.startHats("cloudlinkomega_on_new_peer");
                        break;
                    case "closing":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnecting...`);
                        break;
                    case "closed":
                        console.log(`Peer \"${peerUsername}\" (${peerUUID}) disconnected.`);
                        delete self.cons[peerUUID];
                        break;
                    case "failed":
                        console.warn(`Peer \"${peerUsername}\" (${peerUUID}) failed!`);
                        delete self.cons[peerUUID];
                        break;
                    default:
                        console.error(`Peer \"${peerUsername}\" (${peerUUID}) unknown!`);
                        delete self.cons[peerUUID];
                        break;
                };
            };
        }

        initializeDataChannel(chan, peerUUID, peerUsername) {
            const thisChan = chan;
            const self = this;
            
            thisChan.onopen = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${thisChan.label}\" opened! Is this channel ordered: ${chan.ordered}, ID: ${chan.id}`);
            }

            thisChan.onmessage = (e) => {
                let message = JSON.parse(e.data);
                console.log('Got', message, `from peer \"${peerUsername}\" (${peerUUID}) in channel \"${thisChan.label}\"`);
                switch (message.command) {
                    case "newchan":

                        // Create channel
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
                        
                    case "list":
                        break;

                    // Handle messages
                    case "data":
                        // Store the message
                        let lists = self.cons[peerUUID].chans[String(thisChan.label)].lists;
                        let variables = self.cons[peerUUID].chans[String(thisChan.label)].vars;

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
                        self.cons[peerUUID].chans[String(thisChan.label)].value = message.payload;
                        self.cons[peerUUID].chans[String(thisChan.label)].new = true;
                        break;
                }
            }
            thisChan.onerror = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${thisChan.label}\" error!`, e.error);
                // Destroy channel reference
                delete self.cons[peerUUID].chans[String(thisChan.label)];
            }
            thisChan.onclosing = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${thisChan.label}\" closing...`);
            }
            thisChan.onclose = (e) => {
                console.log(`Peer \"${peerUsername}\" (${peerUUID}) channel \"${thisChan.label}\" closed!`);
                // Destroy channel reference
                delete self.cons[peerUUID].chans[String(thisChan.label)];
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
                self.runtime.startHats("cloudlinkomega_on_signalling_connect");
            };

            self.websocket.onmessage = (event) => {
                let message = JSON.parse(event.data);
                console.log(`Got new message from server:`, message);
                self.handleSignalingMessage(message);
            };

            self.websocket.onclose = () => {
                console.log(`Disconnected from server!`);
                self.websocket = null;
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
            console.log(`Sending message to server:`, message);
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
                    self.initializeCon(con, message.payload.username, message.payload.id, false);

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
                    self.initializeCon(con, message.tx.username, message.tx.id, false);

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
            let peers = {};
            for (const uuid in self.cons) {
                if (self.cons.hasOwnProperty(uuid)) {
                    peers[String(self.cons[uuid].username)] = String(uuid);
                };
            };
            return self.makeValueScratchSafe(peers);
        }

        get_peer_channels(args, util) {
            const self = this;
            /*if (!self.isSignallingConnected()
            || !self.cons.hasOwnProperty(args.PEER)
            ) return "[]";
            return self.makeValueScratchSafe(self.getPeerChannels(args.PEER)); */
            return "[]"; // stub
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
            return new Promise((resolve, reject) => {
                if (!self.cons[args.PEER]) {
                    reject(`Peer ${args.PEER} invalid/not found!`);
                    return;
                };
                let message = { command: "data", payload: args.DATA };
                let chan = self.cons[args.PEER].chans[args.CHANNEL].chan;
                chan.send(JSON.stringify(message));
                console.log("Sent", message, `to peer \"${self.cons[args.PEER].username}\" (${args.PEER}) using channel \"${args.CHANNEL}\"`);
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
                self.cons[args.PEER].chans['default'].chan.send(
                    JSON.stringify({
                        command: "newchan",
                        payload: {
                            id: chanid,
                            ordered: ordered,
                            name: String(args.CHANNEL)
                        }
                    })
                );

                // Increment new channel ID
                self.cons[args.PEER].nextchanid += 1;

                console.log(`Opening data channel  \"${args.CHANNEL}\" with peer \"${username}\"(${args.PEER})`);
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
                let chan = self.cons[args.PEER].chans[String(args.CHANNEL)].chan;
                
                chan.close();
                await new Promise(e => chan.addEventListener("close", e));
                resolve();
            });
        }
    };

    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('cloudlinkomega_on_channel_message');
    });

    Scratch.extensions.register(new CloudLinkOmega(Scratch));
    // vm.extensionManager._registerInternalExtension(new CloudLinkOmega(vm));
})(Scratch);