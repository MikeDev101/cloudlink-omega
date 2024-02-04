class OmegaSignaling {
    constructor(ugi) {
        this.messageHandlers = {
            initSuccess: null,
            onConnect: null,
            onClose: null,
            offer: null,
            answer: null,
            keepalive: null,
            listeners: {},
        };
        this.state = {
            user: '', // username
            id: '', // ULID
            game: '', // game name
            developer: '', // developer name
            mode: 0, // 0 - configuring, 1 - host, 2 - peer
        };
        this.url = new URL("wss://omega.mikedev101.cc/api/v0/signaling");
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
                console.log('Received message:', message);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
    }

    handleMessage(message) {
        const { opcode, payload, origin, listener } = message;

        switch (opcode) {
            case 'INIT_OK':
                console.log('Initialization successful.');
                this.state.user = payload.user;
                this.state.id = payload.id;
                this.state.game = payload.game;
                this.state.developer = payload.developer;
        }

        // Call listeners   
        if (this.messageHandlers[opcode]) {
            if (this.messageHandlers[opcode]) {
                this.messageHandlers[opcode](payload);
            }
        }
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
        this.messageHandlers.offer = callback;
    }

    onAnswer(callback) {
        this.messageHandlers.answer = callback;
    }

    close() {
        this.socket.close();
    }

    sendMessage(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('WebSocket connection not open. Cannot send message:', message);
        }
    }
}

// Example usage:
// const signalingSocket = new OmegaSignaling('01HNPHRWS0N0AYMM5K4HN31V4W'); // Test UGI.