(function (vm) {
    const configuration = { iceServers: [{ urls: 'stun:stun.mikedev101.cc:3478' }] } // Self-hosted coturn server

    // Create map to manage multiple peers
    const peerConnections = new Map();
    const dataChannels = new Map();

    // Create placeholder webSocket object
    let webSocket;

    // Declare function to handle peers
    async function createPeerConnection(peerID) {
        console.log('Creating peer connection object:', peerID);
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnections.set(peerID, peerConnection);

        console.log('Creating peer connection data channel:', peerID);
        const dataChannel = peerConnection.createDataChannel('myDataChannel');

        // Set up event handlers for the data channel
        dataChannel.onopen = async() => {
            console.log(`Data channel for ${peerID} is open`);
        };

        dataChannel.onmessage = async(event) => {
            var payload = JSON.parse(event.data);
            console.log(`Received data from ${peerId}: ${payload.message}`);
        };

        dataChannel.onclose = async() => {
            console.log(`Data channel for ${peerId} is closed`);
        };
    };

    // Send offer to a peer
    async function sendOffer(peerId) {
        if (!webSocket) return;
        const peerConnection = peerConnections.get(peerId);
        if (!peerConnection) {
            console.warn('Can\'t send offer: peer connection object not found:', peerID);
            return;
        }
        peerConnection.createOffer()
            .then((offer) => peerConnection.setLocalDescription(offer))
            .then(() => {
                console.log('Creating offer:', peerConnection.localDescription);
                webSocket.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription, senderPeerId: peerId }));
            });
    }

    // Setup data channel communication for peer
    async function sendData(peerId, message) {
        const dataChannel = dataChannels.get(peerId);
        if (dataChannel && dataChannel.readyState === 'open') {
            var payload = {
                peerID: peerID,
                message: message
            }
            console.log('Sending data channel message: "', payload, '" to peer', peerID);
            await dataChannel.send(JSON.stringify(payload));
        }
    }

    // Handle events from signaling backend
    async function handleSignalingEvent(message) {
        if (message.type === 'offer') {
            const senderPeerId = message.senderPeerId; // Include the sender's peer ID in your WebSocket message
            console.log('Got offer from ', senderPeerId, ', creating peer connection');
            await createPeerConnection(senderPeerId);

            const peerConnection = peerConnections.get(senderPeerId);
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp)) // { type: 'offer', sdp: message.sdp }
            .then(() => peerConnection.createAnswer())
            .then((answer) => peerConnection.setLocalDescription(answer))
            .then(() => {
                console.log('Sending answer to peer', senderPeerId, ':', peerConnection.localDescription);
                webSocket.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription, receiverPeerId: senderPeerId }));
            });
            
        } else if (message.type === 'answer') {
            const receiverPeerId = message.receiverPeerId; // Include the receiver's peer ID in your WebSocket message
            console.log('Got answer from ', receiverPeerId, ', updating peer connection');
            const peerConnection = peerConnections.get(receiverPeerId);
            peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp)); // { type: 'answer', sdp: message.sdp }
        }
    }

    async function declarePeer(myPeerID) {
        if (!webSocket) return; // Socket object must be created
        if (webSocket.readyState != 1) return; // Socket must be connected
        
        // Create my WebRTC peer connection
        console.log('Creating my WebRTC peer');
        const peerConnection = new RTCPeerConnection(configuration);
        peerConnections.set(myPeerID, peerConnection);

        // Create my data channel
        console.log('Creating my WebRTC data channel');
        const dataChannel = peerConnection.createDataChannel('myDataChannel');

        // Set up event handlers for my data channel
        dataChannel.onopen = async () => {
            console.log(`My data channel is open`);
        };
        dataChannel.onmessage = async (event) => {
            var payload = JSON.parse(event.data);
            console.log(`Received data from ${payload.peerID}: ${payload.message}`);
        };
        dataChannel.onclose = async () => {
            console.log(`My data channel is closed`);
        };

        console.log('Declaring myself as peer: ', myPeerID);
        sendOffer(String(myPeerID));
    }

    // Begin communications
    async function initalizeSession(UGI) {
        // Connect to signaling backend
        const backend = `wss://i5-imac.local:3000/ws/${UGI}?v=1.0`;
        console.log('Connecting to signaling backend: ', backend);
        webSocket = new WebSocket(backend);

        // Handle peer offers
        webSocket.onmessage = async(event) => {
            const message = JSON.parse(event.data);
            console.log('Got new signaling message: ', message);
            await handleSignalingEvent(message);
        }

        // Begin sending offer upon connection
        webSocket.onopen = async(event) => {
            console.log('Connected to signaling backend');
        }
    }

    class myExtension {
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
                        opcode: 'initalize',
                        blockType: 'command',
                        text: 'Connect to game [UGI]',
                        arguments: {
                            UGI: {
                                type: 'string',
                                defaultValue: 'DemoUGI',
                            },
                        }
                    },
                    {
                        opcode: 'createOffer',
                        blockType: 'command',
                        text: 'Create offer as name [PEER]',
                        arguments: {
                            PEER: {
                                type: 'string',
                                defaultValue: 'Banana',
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
                ]
            };
        }

        initalize(args) {
            initalizeSession(encodeURI(String(args.UGI)));
        }

        createOffer(args) {
            declarePeer(String(args.PEER));
        }

        send(args) {
            sendData(String(args.PEER), String(args.DATA));
        }
    };
    vm.extensionManager._registerInternalExtension(new myExtension());
})(vm);