(function (Scratch) {

    // Define class to provide message encryption (ECDH P-256 w/ AES-GCM, SPKI w/ base64-encoded public keys)
    class OmegaEncryption {
        constructor() {
            this.publicKeys = new Map(); // Store public keys from peers
            this.secrets = new Map(); // Store derived key secrets
            this.keyPair = null; // ECDH P-256 key pair (public: spki, private: pkcs8)
        }
    
        async generateKeyPair() {
            if (this.keyPair) {
                reject("Key pair already exists");
                return;
            }
            this.keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true,
                ["deriveKey", "deriveBits"]
            );
            return this.keyPair;
        }
    
        async exportPublicKey() {
            // Export this.keyPair.publicKey
            if (!this.keyPair) {
                reject("Key pair does not exist");
                return;
            }
            let exportedKey = await window.crypto.subtle.exportKey("spki", this.keyPair.publicKey);
            return this.arrayBufferToBase64(new Uint8Array(exportedKey));
        }
    
        async importPublicKey(exportedKey) {
            const exportedKeyArray = this.base64ToArrayBuffer(exportedKey);
            const publicKey = await window.crypto.subtle.importKey(
                "spki",
                exportedKeyArray,
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true,
                []
            );
            return publicKey;
        }
    
        async deriveSharedKey(publicKey, privateKey) {
            const sharedKey = await window.crypto.subtle.deriveKey(
                {
                    name: "ECDH",
                    public: publicKey
                },
                privateKey,
                {
                    name: "AES-GCM",
                    length: 256
                },
                true,
                ["encrypt", "decrypt"]
            );
            return sharedKey;
        }
    
        async encryptMessage(message, sharedKey) {
            const encodedMessage = new TextEncoder().encode(message);
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encryptedMessage = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                sharedKey,
                encodedMessage
            );
            const encryptedMessageArray = new Uint8Array(encryptedMessage);
            const encryptedMessageBase64 = this.arrayBufferToBase64(encryptedMessageArray);
            const ivBase64 = this.arrayBufferToBase64(iv);
            return { encryptedMessage: encryptedMessageBase64, iv: ivBase64 };
        }
    
        async decryptMessage(encryptedMessageBase64, ivBase64, sharedKey) {
            const encryptedMessageArray = this.base64ToArrayBuffer(encryptedMessageBase64);
            const iv = this.base64ToArrayBuffer(ivBase64);
            const decryptedMessage = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                sharedKey,
                encryptedMessageArray
            );
            const decodedMessage = new TextDecoder().decode(decryptedMessage);
            return decodedMessage;
        }
    
        arrayBufferToBase64(buffer) {
            let binary = '';
            let bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        }
    
        base64ToArrayBuffer(base64) {
            let binary_string = window.atob(base64);
            let len = binary_string.length;
            let bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes.buffer;
        }
    
        setPublicKey(remotePeerId, publicKey) {
            this.publicKeys.set(remotePeerId, publicKey);
        }
    
        getPublicKey(remotePeerId) {
            return this.publicKeys.get(remotePeerId);
        }

        setSharedKey(remotePeerId, sharedKey) {
            this.secrets.set(remotePeerId, sharedKey);
        }

        getSharedKey(remotePeerId) {
            return this.secrets.get(remotePeerId);
        }
    }
    
    // Define class for authentication
    class AuthManager {
        constructor() {
            this.loginUrl = "https://omega.mikedev101.cc/api/v0/login";
            this.registerUrl = "https://omega.mikedev101.cc/api/v0/register";
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
                    console.warn("Account login failed:", data);
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

    class OmegaRTC {
        constructor() {
            this.configuration = {
                // Public STUN/TURN servers.
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }, // Unencrypted STUN
                    { urls: 'stun:freeturn.net:3478' }, // Unencrypted UDP/TCP STUN
                    { urls: 'stun:freeturn.net:5349' }, // Unencrypted TCP/TLS STUN
                    { urls: 'turn:freeturn.net:3478', username: "free", credential: "free" }, // Unencrypted UDP/TCP TURN
                    { urls: 'turns:freeturn.net:5349', username: "free", credential: "free" }, // Encrypted TLS TURN
                ]
            }
            this.peerConnections = new Map();
            this.voiceConnections = new Map();
            this.dataChannels = new Map();
            this.messageHandlers = {
                onIceCandidate: {},
                onIceGatheringDone: {},
                onChannelOpen: null,
                onChannelMessage: {},
                onChannelClose: null,
            }
            this.iceCandidates = {};
        }

        getPeers() {
            let output = new Object();

            // Convert each entry of peerConnections into [{name: ulid}] format
            let peers = Array.from(this.peerConnections.keys());
            let cons = this.peerConnections;

            // Only include peer connections that are fully established.
            Array.from(peers).forEach((ulid) => {
                if (cons.get(ulid).connectionState == "connected") output[cons.get(ulid).user] = ulid;
            })

            return output;
        }

        getPeerChannels(remoteUserId) {
            if (!this.doesPeerExist(remoteUserId)) return [];
            return Array.from(this.dataChannels.get(remoteUserId).keys());
        }

        // Voice channel functions - Untested.

        async createVoiceOffer(remoteUserId, remoteUserName) {
            const voiceConnection = this.createConnection(remoteUserId, remoteUserName, true);
            this.handleVoiceStream(voiceConnection, remoteUserId, remoteUserName);
            try {
                const offer = await voiceConnection.createOffer();
                await voiceConnection.setLocalDescription(offer);
                return { offer, dataChannel };
            } catch (error) {
                console.error(`Error creating voice offer for ${voiceConnection.user} (${remoteUserId}): ${error}`);
                return null;
            }
        }

        async createVoiceAnswer(remoteUserId, remoteUserName) {
            const voiceConnection = this.createConnection(remoteUserId, remoteUserName, true);
            await this.handleVoiceStream(voiceConnection, remoteUserId, remoteUserName);
            try {
                await voiceConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await voiceConnection.createAnswer();
                await voiceConnection.setLocalDescription(answer);
                return answer;
            } catch (error) {
                console.error(`Error creating voice answer for ${voiceConnection.user} (${remoteUserId}): ${error}`);
                return null;
            }
        }

        async handleVoiceAnswer(remoteUserId, answer) {
            const voiceConnection = this.voiceConnections.get(remoteUserId);
            if (voiceConnection) {
                try {
                    await voiceConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error(`Error handling voice answer for ${voiceConnection.user} (${remoteUserId}): ${error}`);
                }
            } else {
                console.error(`Peer voice connection not found for ${remoteUserId}`);
            }
        }

        addVoiceIceCandidate(remoteUserId, iceCandidate) {
            const voiceConnection = this.voiceConnections.get(remoteUserId);
            if (voiceConnection) {
                try {
                    const candidate = new RTCIceCandidate(iceCandidate);
                    voiceConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error(`Error adding voice ice candidate for ${voiceConnection.user} (${remoteUserId}): ${error}`);
                }
            } else {
                console.error(`Peer voice connection not found for ${remoteUserId}`);
            }
        }
        
        // Data channel functions - Tested, working.
        
        async createDataOffer(remoteUserId, remoteUserName) {
            const peerConnection = this.createConnection(remoteUserId, remoteUserName);
            const dataChannel = this.createDefaultChannel(peerConnection, remoteUserId, remoteUserName);
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                return { offer, dataChannel };
            } catch (error) {
                console.error(`Error creating offer for ${peerConnection.user} (${remoteUserId}): ${error}`);
                return null;
            }
        }
    
        async createDataAnswer(remoteUserId, remoteUserName, offer) {
            const peerConnection = this.createConnection(remoteUserId, remoteUserName, false);
            const dataChannel = this.createDefaultChannel(peerConnection, remoteUserId, remoteUserName);
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                return { answer, dataChannel };
            } catch (error) {
                console.error(`Error creating answer for ${peerConnection.user} (${remoteUserId}): ${error}`);
                return null;
            }
        }
    
        async handleDataAnswer(remoteUserId, answer) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            if (peerConnection) {
                try {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (error) {
                    console.error(`Error handling answer for ${peerConnection.user} (${remoteUserId}): ${error}`);
                }
            } else {
                console.error(`Peer connection not found for ${remoteUserId}`);
            }
        }
    
        addDataIceCandidate(remoteUserId, iceCandidate) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            if (peerConnection) {
                try {
                    const candidate = new RTCIceCandidate(iceCandidate);
                    peerConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error(`Error adding ice candidate for ${peerConnection.user} (${remoteUserId}): ${error}`);
                }
            } else {
                console.error(`Peer connection not found for ${peerConnection.user} (${remoteUserId})`);
            }
        }

        // Common function for creating peer/voice connections
        createConnection(remoteUserId, remoteUserName, isAudioOnly) {
            const conn = new RTCPeerConnection(this.configuration);

            // Set username
            conn.user = remoteUserName;

            // Add channel ID counter
            conn.channelIdCounter = 0;

            // Handle ICE candidate gathering
            conn.onicecandidate = (event) => {
                if (event.candidate) {
                    if (!this.iceCandidates[remoteUserId]) {
                        this.iceCandidates[remoteUserId] = [];
                    }
                    this.iceCandidates[remoteUserId].push(event.candidate);
                    if (this.messageHandlers.onIceCandidate[remoteUserId]) {
                        this.messageHandlers.onIceCandidate[remoteUserId](event.candidate);
                    }
                }
                if (event.target.iceGatheringState === 'complete') {
                    if (this.messageHandlers.onIceGatheringDone[remoteUserId]) {
                        this.messageHandlers.onIceGatheringDone[remoteUserId]();
                    }
                }
            };
            
            // handle data channel creation
            if (!isAudioOnly) {
                conn.ondatachannel = (event) => {
                    const dataChannel = event.channel;
                    this.handleDataChannel(dataChannel, remoteUserId, remoteUserName);
                };
            }
            
            // Handle connection state changes
            conn.onconnectionstatechange = () => {
                switch (conn.connectionState) {
                    case "new":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) created.`);
                        break;
                    case "connecting":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) connecting...`);
                        break;
                    case "connected":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) connected.`);
                        break;
                    case "disconnected":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) disconnecting...`);
                        break;
                    case "closed":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) disconnected.`);
                        if (!isAudioOnly) this.disconnectDataPeer(remoteUserId);
                        break;
                    case "failed":
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) connection failed.`);
                        if (!isAudioOnly) this.disconnectDataPeer(remoteUserId);
                        break;
                    default:
                        console.log(`Peer ${remoteUserName} (${remoteUserId}) connection state unknown.`);
                        break;
                }
            };

            if (isAudioOnly) {
                // Handle incoming tracks
                conn.ontrack = (event) => {
                    console.log(`Adding peer ${remoteUserId} audio stream...`);

                    // Auto-play the received audio stream
                    let audioElement = document.createElement(`audio_${remoteUserId}`);
                    audioElement.id = `audio_${remoteUserId}`;
                    audioElement.srcObject = event.streams[0];
                    audioElement.autoplay = true;

                    // Optional: Attach audio element to DOM for remote playback
                    document.body.appendChild(audioElement);
                };
            }
            
            if (isAudioOnly) this.voiceConnections.set(remoteUserId, conn);
            else this.peerConnections.set(remoteUserId, conn);
    
            return conn;
        }
    
        handleDataChannel(dataChannel, remoteUserId, remoteUserName) {
            if (!this.dataChannels.has(remoteUserId)) {
                const channel = dataChannel;

                // Create custom channel properties
                channel.newestData = new String;

                // Create reference to channel
                this.dataChannels.set(remoteUserId, new Map());
    
                channel.onmessage = (event) => {
                    console.log(`Received message from ${remoteUserName} (${remoteUserId}) in channel ${channel.label}: ${event.data}`);
                    channel.newestData = event.data;
                    if (this.messageHandlers.onChannelMessage[remoteUserId]) {
                        this.messageHandlers.onChannelMessage[remoteUserId](event.data, channel.label);
                    }
                };
    
                channel.onopen = () => {
                    console.log(`Data channel ${channel.label} with ${remoteUserName} (${remoteUserId}) opened`);
                    if (this.messageHandlers.onChannelOpen) {
                        this.messageHandlers.onChannelOpen(remoteUserId, channel.label);
                    }
                };
    
                channel.onclose = () => {
                    console.log(`Data channel ${channel.label} with ${remoteUserName} (${remoteUserId}) closed`);
                    if (this.messageHandlers.onChannelClose) {
                        this.messageHandlers.onChannelClose(remoteUserId, channel.label);
                    }
    
                    if (channel.label == "default") {
                        this.disconnectDataPeer(remoteUserId);
                    } else {
                        this.dataChannels.get(remoteUserId).delete(channel.label);
                    }
                };
                
                // Store reference to channel
                this.dataChannels.get(remoteUserId).set(channel.label, channel);
            }
        }

        handleVoiceStream(voiceConnection, remoteUserId, remoteUserName) {
            // Create a new audio track
            console.log(`Preparing to open voice stream channel with ${remoteUserName} (${remoteUserId})...`);

            navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(track => {
                    console.log("Adding track:", track, `to peer ${remoteUserName} (${remoteUserId})...`);
                    voiceConnection.addTrack(track, stream);
                });
                console.log(`Opened voice stream channel with ${remoteUserName} (${remoteUserId}).`);
            })
            .catch(err => {
                console.error(`Error adding audio stream for peer ${remoteUserName} (${remoteUserId}):`, err);
            });
        }

        closeVoiceStream(remoteUserId) {
            let audioElement = document.getElementById(`audio_${remoteUserId}`);
            if (audioElement) {
                console.log(`Removing peer ${remoteUserId} audio stream...`);
                document.body.removeChild(audioElement);
            }
        }
    
        createChannel(remoteUserId, label, ordered, id) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            const dataChannel = peerConnection.createDataChannel(
                label,
                { negotiated: true, id: id, ordered: ordered, protocol: 'clomega' }
            );
            this.handleDataChannel(dataChannel, remoteUserId, peerConnection.user);
            return dataChannel;
        }

        doesPeerExist(remoteUserId) {
            if (!this.peerConnections.get(remoteUserId)) return false;
            return (this.peerConnections.get(remoteUserId).connectionState == "connected");
        }

        doesPeerChannelExist(remoteUserId, channel) {
            if (!this.doesPeerExist(remoteUserId)) return false;
            return this.dataChannels.get(remoteUserId).has(channel);
        }

        createDefaultChannel(peerConnection, remoteUserId, remoteUserName) {
            const dataChannel = peerConnection.createDataChannel(
                'default',
                { negotiated: true, id: 0, ordered: true, protocol: 'clomega' }
            );
            this.handleDataChannel(dataChannel, remoteUserId, remoteUserName);
            return dataChannel;
        }
    
        sendData(remoteUserId, label, data) {
            const channel = this.dataChannels.get(remoteUserId)?.get(label);
            if (channel) {
                channel.send(data);
            } else {
                console.error(`Data channel ${label} not found for ${remoteUserId}`);
            }
        }

        disconnectDataPeer(remoteUserId) {
            const peerConnection = this.peerConnections.get(remoteUserId);
            if (peerConnection) {
                peerConnection.close();

                // Delete the peerConnection and all ICE candidates gathered
                this.peerConnections.delete(remoteUserId);
                delete this.iceCandidates[remoteUserId];
                
                // Clear all data channels
                if (this.dataChannels.has(remoteUserId)) {
                    const channels = this.dataChannels.get(remoteUserId);
                    for (const channel of channels.values()) {
                        channel.close();
                    }
                    this.dataChannels.delete(remoteUserId);
                }
    
                console.log(`Disconnected peer ${remoteUserId} gracefully.`);
            }
        }
    
        onIceCandidate(remoteUserId, callback) {
            this.messageHandlers.onIceCandidate[remoteUserId] = callback;
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
    
        onChannelMessage(remoteUserId, callback) {
            this.messageHandlers.onChannelMessage[remoteUserId] = callback;
        }
    }

    // Define class to provide signaling for WebRTC and for WebSocket relay (too lazy to make a TURN server)
    class OmegaSignaling {
        constructor() {
            this.keepalive = null;
            this.messageHandlers = {
                onInitSuccess: null,
                onConnect: null,
                onClose: {},
                offer: null,
                answer: null,
                keepalive: null,
                onHostModeConfig: null,
                onPeerModeConfig: null,
                onModeConfigFailure: null,
                onNewHost: null,
                onNewPeer: null,
                onPeerGone: {},
                onHostGone: {},
                onIceCandidateReceived: {},
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
            this.url = new URL("wss://omega.mikedev101.cc/api/v0/signaling");
            this.url.searchParams.append('ugi', ugi);
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {

                // Start keepalive. Only upon successful reply should the keepalive keep running.
                this.sendMessage({ opcode: 'KEEPALIVE' });

                // Start external scripts.
                if (this.messageHandlers.onConnect) this.messageHandlers.onConnect();
            };

            this.socket.onclose = (event) => {

                // Clear values
                this.state.id = "";
                this.state.user = "";
                this.state.developer = "";
                this.state.game = "";
                this.state.mode = 0;
                this.socket = null;

                // Stop keepalive.
                clearTimeout(this.keepalive);

                // Call external scripts.
                Object.keys(this.messageHandlers.onClose).forEach(tag => {
                    this.messageHandlers.onClose[tag](event);
                })
            };

            this.socket.onerror = (error) => {
                console.error('Signaling connection error:', error);
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
                    console.log('Signaling login successful.');
                    this.state.user = payload.user;
                    this.state.id = payload.id;
                    this.state.game = payload.game;
                    this.state.developer = payload.developer;
                    if (this.messageHandlers.onInitSuccess) this.messageHandlers.onInitSuccess();
                    break;
                case "ACK_HOST":
                    console.log("Acknowledgement received: Operating in host mode.");
                    if (this.messageHandlers.onHostModeConfig) this.messageHandlers.onHostModeConfig();
                    this.state.mode = 1;
                    break;
                case "ACK_PEER":
                    console.log("Acknowledgement received: Operating in peer mode.");
                    if (this.messageHandlers.onPeerModeConfig) this.messageHandlers.onPeerModeConfig();
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
                    console.warn("Protocol warning: Attempted to send offer while operating in peer mode (or flexible host mode is turned off)");
                    break;
                case "NOT_PEER":
                    console.warn("Protocol warning: Attempted to send answer while operating in host mode. (or flexible host mode is turned off)");
                    break;
                case "KEEPALIVE":
                    this.keepalive = setTimeout(() => {
                        this.sendMessage({ opcode: 'KEEPALIVE' });
                    }, 5000); // 5 seconds delay
                    break;
                case "LOBBY_FULL":
                    console.warn("Lobby is full.");
                    if (this.messageHandlers.onModeConfigFailure) this.messageHandlers.onModeConfigFailure(opcode);
                    break;
                case "LOBBY_EXISTS":
                    console.warn("Lobby already exists.");
                    if (this.messageHandlers.onModeConfigFailure) this.messageHandlers.onModeConfigFailure(opcode);
                    break;
                case "LOBBY_NOTFOUND":
                    console.warn("Lobby does not exist.");
                    if (this.messageHandlers.onModeConfigFailure) this.messageHandlers.onModeConfigFailure(opcode);
                    break;
                case "LOBBY_LOCKED":
                    console.warn("Lobby is not accepting connections at this time.");
                    if (this.messageHandlers.onModeConfigFailure) this.messageHandlers.onModeConfigFailure(opcode);
                    break;
                case "PASSWORD_FAIL":
                    console.warn("Lobby is password protected and incorrect password was provided.");
                    if (this.messageHandlers.onModeConfigFailure) this.messageHandlers.onModeConfigFailure(opcode);
                    break;
                case "LOBBY_CLOSE":
                    console.log("Lobby closed. Disconnecting...");
                    this.Disconnect();
                    break;
                case "HOST_GONE":
                    console.log("The host has left.");
                    // To be compliant with the protocol, we must disconnect the host (or delete the object for it)
                    if (this.messageHandlers.onHostGone[payload]) this.messageHandlers.onHostGone[payload]();
                    break;
                case "PEER_GONE":
                    console.log(`Peer ${payload} has left.`);
                    // To be compliant with the protocol, we must disconnect the peer (or delete the object for it)
                    if (this.messageHandlers.onPeerGone[payload]) this.messageHandlers.onPeerGone[payload]();
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
                    if (this.messageHandlers.onNewPeer) this.messageHandlers.onNewPeer(payload.id, payload.user);
                    break;
                case "NEW_HOST":
                    if (this.state.mode != 0) { // require configuring mode
                        console.warn("Protocol bug: Received NEW_HOST message while operating in host/peer mode.");
                        return;
                    }
                    if (this.messageHandlers.onNewHost) this.messageHandlers.onNewHost(payload.id, payload.lobby_id, payload.user);
                    break;
                case "MAKE_OFFER":
                    if (this.state.mode != 2) { // require peer mode
                        console.warn("Protocol bug: Received MAKE_OFFER message while operating in host/configuring mode.");
                        return;
                    }
                    if (this.messageHandlers.onOffer) this.messageHandlers.onOffer(origin, payload);
                    break;
                case "MAKE_ANSWER":
                    if (this.state.mode != 1) { // require host mode
                        console.warn("Protocol bug: Received MAKE_ANSWER message while operating in peer/configuring mode.");
                        return;
                    }
                    if (this.messageHandlers.onAnswer[origin]) this.messageHandlers.onAnswer[origin](origin, payload);
                    break;
                case "ICE":
                    if (this.state.mode == 0) { // require host/peer mode
                        console.warn("Protocol bug: Received ICE message while operating in configuring mode.");
                        return;
                    }
                    this.messageHandlers.onIceCandidateReceived(origin, payload);
                    break;
            }

            // Call listeners   
            if (this.messageHandlers[listener]) this.messageHandlers[listener](message);
        }

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

        onPeerGone(remoteUserId, callback) {
            this.messageHandlers.onPeerGone[remoteUserId] = callback;
        }

        onHostGone(remoteUserId, callback) {
            this.messageHandlers.onHostGone[remoteUserId] = callback;
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

        onModeConfigFailure(callback) {
            this.messageHandlers.onModeConfigFailure = callback;
        }

        onIceCandidateReceived(callback) {
            this.messageHandlers.onIceCandidateReceived = callback;
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

        onClose(tag, callback) {
            this.messageHandlers.onClose[tag] = callback;
        }
    }

    // Define the extension class that glues the two previous classes together
    class CloudLinkOmega {
        constructor(Scratch) {
            this.vm = Scratch.vm; // VM
            this.runtime = Scratch.vm.runtime; // Runtime
            this.targets = Scratch.vm.runtime.targets // Access variables
            this.hasMicPerms = false;
            this.Signaling = new OmegaSignaling();
            this.WebRTC = new OmegaRTC();
            this.AuthManager = new AuthManager();
            
            // Define icons
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
                                defaultValue: '01HNPHRWS0N0AYMM5K4HN31V4W', // Test game ID.
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

        makeValueSafeForScratch(data) {
            try {
                // Check if data is an object/JSON
                if (typeof data === 'object' && data !== null) {
                    return JSON.stringify(data);
                } else if (typeof data === 'string') {
                    return data;
                } else {
                    // Return data as-is for other types
                    return data;
                }
            } catch (error) {
                // Return data as-is if conversion fails
                return data;
            }
        }

        clOmegaProtocolMessageHandler(origin, channel, message) {
            console.log(`Received message from ${origin} in channel ${channel}: ${message}`);
            const {opcode, payload} = message;

            switch (opcode) {
                case "PKEY":
                    break;
                case "G_MSG":
                    break;
                case "G_VAR":
                    break;
                case "G_LIST":
                    break;
                case "P_MSG":
                    break;
                case "P_VAR":
                    break;
                case "P_LIST":
                    break;
                case "RING":
                    break;
                case "PICKUP":
                    break;
                case "HANGUP":
                    break;
                case "V_OFFER":
                    break;
                case "V_ANSWER":
                    break;
                case "V_ICE":
                    break;
            }
        }

        initialize({ UGI }) {
            const self = this;
            if (!self.Signaling.socket) {
                return new Promise((resolve, reject) => {
                    self.Signaling.Connect(UGI);

                    // Bind event handlers
                    self.Signaling.onConnect(() => {
                        console.log('Connected to signaling server.');

                        // Return the promise.
                        resolve();
                    })

                    self.Signaling.onClose("auto", () => {
                        console.log('Disconnected from signaling server.');

                        // To be compliant with the protocol, we must close all peer connections.
                        console.log(`There are ${self.WebRTC.peerConnections.size} peer connections to close.`);
                        Array.from(self.WebRTC.peerConnections.keys()).forEach((peer) => {
                            self.WebRTC.disconnectDataPeer(peer);
                        })

                        // If this was a failed connection attempt, return the promise with a rejection.
                        reject();
                    })

                    self.Signaling.onNewPeer(async (peer, user) => {
                        console.log(`New peer: ${user} (${peer})`);

                        // Create handler for PEER_GONE
                        self.Signaling.onPeerGone(peer, () => {
                            self.WebRTC.disconnectDataPeer(peer);
                        })

                        // Create offer
                        const { offer, dataChannel } = await self.WebRTC.createDataOffer(peer, user);

                        // Send created offer
                        console.log(`Sending offer to ${user} (${peer})`);
                        self.Signaling.sendOffer(peer, offer, null);

                        // Configure onAnswer event
                        self.Signaling.onAnswer(peer, async(origin, answer) => {

                            // Handle answer to offer
                            console.log(`Got answer from ${user} (${origin})`);
                            await self.WebRTC.handleDataAnswer(origin, answer);

                            // Begin sending Trickle ICE candidates
                            self.WebRTC.onIceCandidate(origin, (candidate) => {
                                console.log(`Sending trickle ICE candidate to ${user} (${origin})`);
                                self.Signaling.sendIceCandidate(origin, candidate);

                                // Remove the candidate from the queue so we don't accidentally resend it
                                if (self.WebRTC.iceCandidates[origin].includes(candidate)) {
                                    self.WebRTC.iceCandidates[origin].splice(self.WebRTC.iceCandidates[origin].indexOf(candidate), 1);
                                }
                            })

                            // If we are done gathering ICE candidates, send the remaining ones
                            self.WebRTC.onIceGatheringDone(origin, () => {
                                console.log(`Sending remaining tricke ICE candidates to ${user} (${origin})`);
                                self.WebRTC.iceCandidates[origin].forEach((candidate) => {
                                    self.Signaling.sendIceCandidate(origin, candidate);
                                })
                            })

                            // Bind message handler
                            self.WebRTC.onChannelMessage(origin, async(payload, channel) => {
                                self.clOmegaProtocolMessageHandler(origin, channel, payload);
                            })
                        })
                    })

                    self.Signaling.onNewHost((peer, lobby, user) => {
                        console.log(`New host: ${user} (${peer}) in lobby ${lobby}`);

                        // Create handler for HOST_GONE
                        self.Signaling.onHostGone(peer, () => {
                            self.WebRTC.disconnectDataPeer(peer);
                        })

                        // Configure onOffer event
                        self.Signaling.onOffer(async (origin, offer) => {

                            // Make answer from offer
                            console.log(`Got offer from ${user} (${origin})`);
                            const { answer, dataChannel } = await self.WebRTC.createDataAnswer(origin, user, offer);
                            
                            // Send answer
                            console.log(`Sending answer to ${user} (${origin})`);
                            self.Signaling.sendAnswer(origin, answer, null);

                            // Begin sending Trickle ICE candidates
                            self.WebRTC.onIceCandidate(origin, (candidate) => {
                                console.log(`Sending trickle ICE candidate to ${user} (${origin})`);
                                self.Signaling.sendIceCandidate(origin, candidate);

                                // Remove the candidate from the queue so we don't accidentally resend it
                                if (self.WebRTC.iceCandidates[origin].includes(candidate)) {
                                    self.WebRTC.iceCandidates[origin].splice(self.WebRTC.iceCandidates[origin].indexOf(candidate), 1);
                                }
                            })

                            // If we are done gathering ICE candidates, send the remaining ones
                            self.WebRTC.onIceGatheringDone(origin, () => {
                                console.log(`Sending remaining tricke ICE candidates to ${user} (${origin})`);
                                self.WebRTC.iceCandidates[origin].forEach((candidate) => {
                                    self.Signaling.sendIceCandidate(origin, candidate);
                                })
                            })

                            // Bind message handler
                            self.WebRTC.onChannelMessage(origin, async(payload, channel) => {
                                self.clOmegaProtocolMessageHandler(origin, channel, payload);
                            })
                        })
                    })

                    self.Signaling.onIceCandidateReceived(async(origin, iceCandidate) => {
                        console.log(`Got ICE candidate from ${origin}`);
                        self.WebRTC.addDataIceCandidate(origin, iceCandidate);
                    })
                });
            }
        }

        init_host_mode({LOBBY, PEERS, PASSWORD, CLAIMCONFIG}) {
            const self = this;
            return new Promise(async(resolve, reject) => {
                if (!self.Signaling.socket) {
                    console.warn('Signaling server not connected');
                    reject();
                    return;
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

                self.Signaling.onHostModeConfig(() => {
                    resolve();
                })

                self.Signaling.onModeConfigFailure(() => {
                    reject();
                })
            })
        }

        init_peer_mode({LOBBY, PASSWORD}) {
            const self = this;
            return new Promise((resolve, reject) => {
                if (!self.Signaling.socket) {
                    console.warn('Signaling server not connected');
                    reject();
                    return;
                }
                self.Signaling.peerMode(LOBBY, PASSWORD, null);

                self.Signaling.onPeerModeConfig(() => {
                    resolve();
                })

                self.Signaling.onModeConfigFailure(() => {
                    reject();
                })
            })
        }

        send({DATA, PEER, CHANNEL, WAIT}) {
            const self = this;

            // Get peer.
            const peer = self.WebRTC.dataChannels.get(PEER);

            if (!peer) {
                console.warn(`Peer ${PEER} not found`);
                return;
            }

            // Get channel from peer.
            const channel = peer.get(CHANNEL);

            if (!channel) {
                console.warn(`Channel ${CHANNEL} not found for peer ${PEER}`);
                return;
            }

            if (WAIT) channel.bufferedAmountThreshold = 0; 

            // TODO: Implement cryptography support for relayed data
            channel.send(JSON.stringify({
                opcode: "gdata",
                payload: DATA,
                origin: self.Signaling.state.user,
            }))

            if (WAIT) return new Promise((resolve) => {
                channel.onbufferedamountlow = () => {
                    resolve();
                }
            })
        }

        disconnect_peer({PEER}) {
            const self = this;
            self.WebRTC.disconnectDataPeer(PEER);
        }

        leave() {
            const self = this;
            if (!self.Signaling.socket) {
                return;
            }
            return new Promise((resolve) => {
                self.Signaling.Disconnect();
                self.Signaling.onClose("manual", () => {
                    resolve();
                })
            })
        }

        is_signalling_connected() {
            if (!this.Signaling.socket) {
                return false;
            }
            return (this.Signaling.socket.readyState === 1);
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

        get_peers() {
            const self = this;
            return self.makeValueSafeForScratch(self.WebRTC.getPeers());
        }

        async authenticateWithCredentials({ EMAIL, PASSWORD }) {
            const self = this;
            if (!self.Signaling.socket) {
                console.warn('Signaling server not connected');
                return;
            };
            await self.AuthManager.Login(EMAIL, PASSWORD);
            if (self.AuthManager.loginSuccess) {
                self.Signaling.authenticateWithToken(self.AuthManager.sessionToken, null);
            }
        }

        authenticateWithToken({TOKEN}) {
            const self = this;
            if (!self.Signaling.socket) {
                console.warn('Signaling server not connected');
                return;
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
        async request_mic_perms() {
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

        get_mic_perms() {
            const self = this;
            return self.hasMicPerms;
        }

        new_dchan({CHANNEL, PEER, ORDERED}) {
            const self = this;

            // Check if peer exists
            if (!self.WebRTC.doesPeerExist(PEER)) {
                console.warn(`Peer ${PEER} not found.`);
                return;
            }
            self.WebRTC.createChannel(PEER, CHANNEL, (ORDERED == 1));
        }

        new_vchan({PEER}) {
            const self = this;

            // Check if peer exists
            if (!self.WebRTC.doesPeerExist(PEER)) {
                console.warn(`Peer ${PEER} not found.`);
                return;
            }

            // self.WebRTC.openVoiceStream(PEER);
        }

        close_vchan({PEER}) {
            const self = this;

            // Check if peer exists
            if (!self.WebRTC.doesPeerExist(PEER)) {
                console.warn(`Peer ${PEER} not found.`);
                return;
            }

            // self.WebRTC.closeVoiceStream(PEER);
        }
        

        close_dchan({CHANNEL, PEER}) {
            const self = this;
            if (CHANNEL == "default") {
                console.warn("You may not close the default data channel.");
                return;
            }

            // Check if peer exists
            if (!self.WebRTC.doesPeerExist(PEER)) {
                console.warn(`Peer ${PEER} not found.`);
                return;
            }

            if (!self.WebRTC.dataChannels.get(PEER).get(CHANNEL)) {
                console.warn(`Channel ${CHANNEL} does not exist for peer ${PEER}`);
                return;
            }

            self.WebRTC.dataChannels.get(PEER).get(CHANNEL).close();
        }

        get_peer_channels({PEER}) {
            const self = this;
            return self.makeValueSafeForScratch(self.WebRTC.getPeerChannels(PEER));
        }

        is_peer_connected({PEER}) {
            const self = this;
            return self.WebRTC.doesPeerExist(PEER);
        }

        get_channel_data({CHANNEL, PEER}) {
            const self = this;
            if (!self.WebRTC.doesPeerChannelExist(PEER, CHANNEL)) return "";
            return self.makeValueSafeForScratch(self.WebRTC.dataChannels.get(PEER).get(CHANNEL).newestData);
        }
    };

    /*
    Scratch.vm.runtime.on('BEFORE_EXECUTE', () => {
        Scratch.vm.runtime.startHats('cloudlinkomega_on_dchan_message');
        Scratch.vm.runtime.startHats('cloudlinkomega_on_channel_networked_list');
    });*/

    Scratch.extensions.register(new CloudLinkOmega(Scratch));
})(Scratch);